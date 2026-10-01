// Loads the exe with .NET (or Mono) and prints its entry point, every embedded
// file with a hash, and a hash of all the program code, so an original and a
// repacked exe can be compared: only the replaced files should differ.
//   csc Check.cs  (or: mcs Check.cs)
//   mono Check.exe WebStudiosBrowser.exe <folder with the WebView2 dlls>
using System; using System.IO; using System.Reflection; using System.Security.Cryptography; using System.Linq; using System.Runtime.InteropServices;
class Check { static void Main(string[] a) {
  string dir = Path.GetFullPath(a[1]);
  AppDomain.CurrentDomain.AssemblyResolve += (s, e) => { var p = Path.Combine(dir, new AssemblyName(e.Name).Name + ".dll"); return File.Exists(p) ? Assembly.LoadFile(p) : null; };
  var asm = Assembly.LoadFile(Path.GetFullPath(a[0]));
  Console.WriteLine("entry: " + asm.EntryPoint.DeclaringType.FullName + "." + asm.EntryPoint.Name);
  foreach (var n in asm.GetManifestResourceNames().OrderBy(x => x)) {
    using (var s = asm.GetManifestResourceStream(n)) { var ms = new MemoryStream(); s.CopyTo(ms);
      Console.WriteLine("res " + n + " " + ms.Length + " " + BitConverter.ToString(SHA256.Create().ComputeHash(ms.ToArray())).Replace("-", "").Substring(0, 16)); } }
  Type[] ts;
  try { ts = asm.GetTypes(); } catch (ReflectionTypeLoadException e) { ts = e.Types.Where(t => t != null).ToArray(); Console.WriteLine("unloadable types " + e.Types.Count(t => t == null)); }
  var all = new MemoryStream(); int n2 = 0;
  foreach (var t in ts.OrderBy(t => t.FullName)) foreach (var m in t.GetMethods(BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance|BindingFlags.Static|BindingFlags.DeclaredOnly).Cast<MethodBase>()
      .Concat(t.GetConstructors(BindingFlags.Public|BindingFlags.NonPublic|BindingFlags.Instance|BindingFlags.Static|BindingFlags.DeclaredOnly)).OrderBy(m => m.MetadataToken)) {
    MethodBody b; try { b = m.GetMethodBody(); } catch (Exception ex) { Console.WriteLine("no body " + m.Name + " " + ex.GetType().Name); continue; } if (b == null) continue; var il = b.GetILAsByteArray(); all.Write(il, 0, il.Length); n2++; }
  Console.WriteLine("types " + ts.Length + ", method bodies " + n2 + ", IL hash " + BitConverter.ToString(SHA256.Create().ComputeHash(all.ToArray())).Replace("-", "").Substring(0, 16));
  foreach (var t in ts.Where(t => t.Name.Contains("PrivateImplementationDetails")))
    foreach (var f in t.GetFields(BindingFlags.Static|BindingFlags.NonPublic|BindingFlags.Public).Where(f => (f.Attributes & FieldAttributes.HasFieldRVA) != 0).OrderBy(f => f.MetadataToken)) {
      var v = f.GetValue(null); int sz = Marshal.SizeOf(v.GetType()); var p = Marshal.AllocHGlobal(sz); Marshal.StructureToPtr(v, p, false);
      var bytes = new byte[sz]; Marshal.Copy(p, bytes, 0, sz); Marshal.FreeHGlobal(p);
      Console.WriteLine("field data " + BitConverter.ToString(bytes)); }
} }
