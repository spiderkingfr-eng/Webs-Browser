"""Put new versions of the embedded files (HTML pages, scripts) back into
WebStudiosBrowser.exe without the source code.

The exe is a .NET Framework assembly. Its .text section holds, in order:
the CLI header, the IL code, the managed resources blob, three small mapped
fields (FieldRVA), and the metadata. The .rsrc section (icon, version info,
manifest) follows. We rebuild .text with a new resources blob, move what
comes after it by a multiple of 16 bytes (so every alignment stays the same),
patch the few places that point into the moved part, and move .rsrc.

usage: repack.py original.exe new_files_dir out.exe
Files in new_files_dir replace the resource with the same name; the rest
are kept exactly as they were."""
import os, struct, sys
import pefile, dnfile

src, newdir, out = sys.argv[1:4]
raw = bytearray(open(src, "rb").read())
pe = pefile.PE(data=bytes(raw))
dn = dnfile.dnPE(data=bytes(raw))
assert len(pe.sections) == 2, "expected .text and .rsrc"
text, rsrc = pe.sections
assert text.Name.rstrip(b"\0") == b".text" and rsrc.Name.rstrip(b"\0") == b".rsrc"
FA, SA = pe.OPTIONAL_HEADER.FileAlignment, pe.OPTIONAL_HEADER.SectionAlignment
align = lambda v, a: (v + a - 1) // a * a

cli_rva = pe.OPTIONAL_HEADER.DATA_DIRECTORY[14].VirtualAddress
off = lambda rva: rva - text.VirtualAddress + text.PointerToRawData   # file offset of an RVA in .text
cli = off(cli_rva)
md_rva, md_size, flags, ep, res_rva, res_size, sn_rva, sn_size = struct.unpack_from("<IIIIIIII", raw, cli + 8)
assert sn_rva == 0 and sn_size == 0, "strong-name signed assemblies are not handled"
res_end = res_rva + res_size
text_end = text.VirtualAddress + text.Misc_VirtualSize
assert res_rva < res_end <= md_rva < md_rva + md_size <= text_end
# nothing but data may live between the resources and the end of .text
for m in dn.net.mdtables.MethodDef.rows:
    assert not m.Rva or m.Rva < res_rva, "method body after the resources"
for d in pe.OPTIONAL_HEADER.DATA_DIRECTORY:
    if d.VirtualAddress and d.name not in ("IMAGE_DIRECTORY_ENTRY_RESOURCE", "IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR"):
        raise SystemExit("unexpected data directory " + d.name)

# ---- the new resources blob, in the original order
rows = dn.net.mdtables.ManifestResource.rows
order = sorted(range(len(rows)), key=lambda i: rows[i].Offset)
blob = bytearray(); new_off = {}; replaced = []
for i in order:
    r = rows[i]; name = str(r.Name)
    o = res_rva + r.Offset
    n = struct.unpack_from("<I", raw, off(o))[0]
    data = bytes(raw[off(o) + 4: off(o) + 4 + n])
    p = os.path.join(newdir, name)
    if os.path.exists(p):
        nd = open(p, "rb").read()
        if nd != data: replaced.append((name, len(data), len(nd)))
        data = nd
    new_off[i] = len(blob)
    blob += struct.pack("<I", len(data)) + data
new_res_size = len(blob)
delta = new_res_size - res_size
delta = (delta + 15) // 16 * 16           # keep everything after it on the same 16-byte alignment
blob += b"\0" * (res_size + delta - new_res_size)

# ---- new .text: [start .. resources) + blob + [resources end .. end of .text]
t0 = text.PointerToRawData
head = raw[t0: off(res_rva)]
tail = raw[off(res_end): off(text_end)]
new_text = bytearray(head + blob + tail)
base = text.VirtualAddress
def put(rva, fmt, *v): struct.pack_into(fmt, new_text, rva - base if rva < res_end else rva - base + delta, *v)

# CLI header: metadata moved, resources resized
struct.pack_into("<I", new_text, cli_rva - base + 8, md_rva + delta)
struct.pack_into("<I", new_text, cli_rva - base + 28, align(new_res_size, 4))   # the compiler rounds this up to 4

# metadata tables: ManifestResource.Offset and FieldRVA.Rva are fixed-size fields, patched in place
md_new = md_rva + delta - base     # offset of the metadata inside new_text
tables = dn.net.mdtables
tstream = [s for s in dn.net.metadata.streams_list if s.struct.Name.startswith(b"#~") or s.struct.Name.startswith(b"#-")][0]
tbl_base = md_new + tstream.struct.Offset   # where the #~ stream starts in new_text
# work out the offset of each table's rows inside #~ from dnfile's own sizes
st = bytes(new_text[tbl_base: tbl_base + tstream.struct.Size])
valid = struct.unpack_from("<Q", st, 8)[0]
n_tables = bin(valid).count("1")
pos = 24 + 4 * n_tables
heap_sizes = st[6]
if heap_sizes & 0x40: pos += 4   # extra data
present = [i for i in range(64) if valid >> i & 1]
by_number = {}
for t in tables.tables_list:
    by_number[t.number] = t
row_start = {}
for num in present:
    t = by_number[num]
    row_start[num] = pos
    pos += t.row_size * t.num_rows
mr = tables.ManifestResource
for i, r in enumerate(mr.rows):
    o = tbl_base + row_start[mr.number] + i * mr.row_size
    assert struct.unpack_from("<I", new_text, o)[0] == r.Offset
    struct.pack_into("<I", new_text, o, new_off[i])
fr = tables.FieldRva
if fr:
    for i, r in enumerate(fr.rows):
        o = tbl_base + row_start[fr.number] + i * fr.row_size
        assert struct.unpack_from("<I", new_text, o)[0] == r.Rva
        if r.Rva >= res_end:
            assert r.Rva < md_rva
            struct.pack_into("<I", new_text, o, r.Rva + delta)
        else:
            assert r.Rva < res_rva

new_vsize = text.Misc_VirtualSize + delta
new_raw_size = align(new_vsize, FA)
new_text += b"\0" * (new_raw_size - len(new_text))

# ---- .rsrc moves to the next free page; its data entries hold RVAs
r_va_new = align(base + new_vsize, SA)
r_ptr_new = t0 + new_raw_size
r_delta = r_va_new - rsrc.VirtualAddress
rs = bytearray(raw[rsrc.PointerToRawData: rsrc.PointerToRawData + rsrc.SizeOfRawData])
def walk(d):
    for e in d.entries:
        if hasattr(e, "directory"): walk(e.directory)
        else:
            ds = e.data.struct
            o = ds.get_file_offset() - rsrc.PointerToRawData
            assert struct.unpack_from("<I", rs, o)[0] == ds.OffsetToData
            struct.pack_into("<I", rs, o, ds.OffsetToData + r_delta)
walk(pe.DIRECTORY_ENTRY_RESOURCE)

# ---- headers
hdr = bytearray(raw[:t0])
oh = pe.OPTIONAL_HEADER.get_file_offset()
# field offsets inside the PE32+ optional header
OH = {"SizeOfCode":4, "SizeOfInitializedData":8, "SizeOfImage":56, "CheckSum":64}
assert pe.OPTIONAL_HEADER.Magic == 0x20b
struct.pack_into("<I", hdr, oh + OH["SizeOfCode"], new_raw_size)
struct.pack_into("<I", hdr, oh + OH["SizeOfInitializedData"], rsrc.SizeOfRawData)
struct.pack_into("<I", hdr, oh + OH["SizeOfImage"], align(r_va_new + rsrc.Misc_VirtualSize, SA))
dd = oh + 112                      # data directories of a PE32+ optional header
struct.pack_into("<I", hdr, dd + 2 * 8, r_va_new)
sec = text.get_file_offset()
struct.pack_into("<II", hdr, sec + 8, new_vsize, base)
struct.pack_into("<II", hdr, sec + 16, new_raw_size, t0)
sec2 = rsrc.get_file_offset()
struct.pack_into("<II", hdr, sec2 + 8, rsrc.Misc_VirtualSize, r_va_new)
struct.pack_into("<II", hdr, sec2 + 16, rsrc.SizeOfRawData, r_ptr_new)

result = bytearray(bytes(hdr) + bytes(new_text) + bytes(rs) + bytes(raw[rsrc.PointerToRawData + rsrc.SizeOfRawData:]))
if pe.OPTIONAL_HEADER.CheckSum:            # the original has none; only refresh one that was there
    struct.pack_into("<I", result, oh + OH["CheckSum"], pefile.PE(data=bytes(result)).generate_checksum())
open(out, "wb").write(result)
print("replaced:", ", ".join("%s (%d -> %d bytes)" % x for x in replaced) or "nothing")
print("text grew by %d bytes; file %d -> %d bytes" % (delta, len(raw), len(result)))
