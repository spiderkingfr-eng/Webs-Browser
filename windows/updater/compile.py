"""Compiles WebsUpdate.cs the way Windows runs it.

    python3 updater/compile.py <source.cs> <out.exe>

With Mono's compiler (mcs) it builds against Microsoft's .NET Framework 4.8
reference assemblies, not Mono's own libraries: Mono's have methods that
Windows doesn't, and the compiler picks them without a word. (The updater in
Windows 3.7.0 called String.TrimEnd(char), which .NET Framework lacks, so it
stopped on every PC.) Against the real ones, such a call either picks the
method Windows has or doesn't compile at all.

The reference assemblies come from NuGet once (Microsoft's package, checked
against the SHA-512 NuGet publishes for it) and are kept in out/netfx48/.
On Windows, csc uses the real .NET Framework anyway."""
import base64, hashlib, io, os, shutil, subprocess, sys, urllib.request, zipfile

here = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.join(here, "..", "out", "netfx48")
PKG = "https://api.nuget.org/v3-flatcontainer/microsoft.netframework.referenceassemblies.net48/1.0.3/microsoft.netframework.referenceassemblies.net48.1.0.3.nupkg"
SHA512 = "XWKgyeNadNcTQaIVvQB8BrdCNrEar6fo/de1OdQRZ9HFy0jcBSaM8IV5q64ZampsSnC8AlTsACaGZUuoFw41RA=="
DLLS = ["mscorlib.dll", "System.dll", "System.Core.dll", "System.Web.Extensions.dll", "System.Windows.Forms.dll", "System.Drawing.dll"]

def fetch():
    try:
        with urllib.request.urlopen(PKG, timeout=120) as r: return r.read()
    except Exception:
        if not shutil.which("curl"): raise
        return subprocess.run(["curl", "-sSLf", "-m", "180", PKG], check=True, capture_output=True).stdout

def refs():
    if all(os.path.exists(os.path.join(REFS, d)) for d in DLLS): return REFS
    data = fetch()
    if base64.b64encode(hashlib.sha512(data).digest()).decode() != SHA512:
        sys.exit("compile: the .NET Framework reference package doesn't match its checksum; not building")
    os.makedirs(REFS, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for d in DLLS:
            with open(os.path.join(REFS, d), "wb") as f: f.write(z.read("build/.NETFramework/v4.8/" + d))
    return REFS

def build(src, out):
    if shutil.which("mcs"):
        r = refs()
        cmd = ["mcs", "-nostdlib", "-noconfig", "-target:winexe", "-platform:anycpu", "-optimize+", "-out:" + out, src] + ["-r:" + os.path.join(r, d) for d in DLLS]
    elif shutil.which("csc"):
        cmd = ["csc", "/nologo", "/target:winexe", "/platform:anycpu", "/optimize+", "/r:System.Web.Extensions.dll", "/out:" + out, src]
    else: sys.exit("compile: there is no C# compiler (mcs or csc)")
    subprocess.run(cmd, check=True)

if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit(__doc__)
    build(os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2]))
