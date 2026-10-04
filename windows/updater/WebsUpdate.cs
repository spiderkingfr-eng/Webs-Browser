// WebsUpdate.exe: installs Webs Browser, and keeps it up to date by itself.
//
// Open it once (as the setup for a new computer, or the last time the browser
// asks you to download it) and it:
//   - copies itself to %LOCALAPPDATA%\Programs\Webs Browser and starts with
//     Windows (HKCU\...\Run, no admin needed), quietly in the background;
//   - downloads the newest WebStudiosBrowser.exe, checks it against the SHA-256
//     in updates/latest.json, puts it in place and opens the browser.
// From then on the background copy checks GitHub every few hours and installs
// new versions by itself: when the browser is closed, at once; while it is
// open, the new exe goes in place (a running exe can be renamed, not
// replaced) and starts the next time the browser does. The browser's
// "Update now" / "Restart to update" button asks it through a folder (inbox)
// the browser can write to, and the background copy closes the browser the
// way the X button does (tabs are saved), and opens the new version.
// It reports to the browser in ui\user\webs-update.json in the browser's data
// folder, which the browser reads as https://browser.example/user/webs-update.json.
// Nothing is downloaded through the browser any more, so Windows doesn't ask.
//
// 2.1 (Webs 3.7): the owner's dashboard can send a new version to some computers
// first (a gradual rollout: "rollout.win" {v, pct} in the Web AI server's /live),
// and put every computer back on the version before ("rollback.win", the version
// that latest.json names as "previous", checked against its own SHA-256 too).
// Each computer has a number from 0 to 99 (from a random id kept in the install
// folder); during a rollout to pct%, numbers below pct get it by themselves.
// Asking for the update in the browser (or opening this program) installs it at
// once. If the server can't be reached, updates work the way they always did.
//
// Build: python3 compile.py WebsUpdate.cs WebsUpdate.exe (with Mono, against the .NET Framework 4.8
// reference assemblies: Mono's own libraries have methods Windows doesn't, see compile.py)
//    or, on Windows: csc /target:winexe /r:System.Web.Extensions.dll WebsUpdate.cs
//
// --background   the background copy (started with Windows)
// --uninstall    stop it and don't start it with Windows any more
// For testing: --quiet (no window), --once (one background round, then exit),
// --manifest <url>, --target <exe>, --install-dir <dir>, --data-dir <dir>,
// --no-restart, --no-close, --no-autostart, --bucket <0-99>.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("Webs Browser updater")]
[assembly: System.Reflection.AssemblyProduct("Webs Browser")]
[assembly: System.Reflection.AssemblyVersion("2.1.1.0")]

static class Updater
{
    public const string Version = "2.1.1";
    const string DefaultManifest = "https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/latest.json";
    const string ExeName = "WebStudiosBrowser.exe", SelfName = "WebsUpdate.exe", RunName = "WebsBrowserUpdater";
    static readonly Regex FromRepo = new Regex(@"^https://(raw\.githubusercontent\.com|github\.com)/spiderkingfr-eng/Webs-Browser/", RegexOptions.IgnoreCase);
    static readonly Regex Loopback = new Regex(@"^http://(127\.0\.0\.1|localhost)(:\d+)?/", RegexOptions.IgnoreCase);

    public static bool Quiet, NoRestart, NoClose, NoAutostart, CustomManifest, Background, Once, Uninstall;
    public static string ManifestUrl = DefaultManifest, Target, InstallDirArg, DataDirArg;
    public static int BucketArg = -1;
    static string logPath;

    [STAThread]
    static int Main(string[] args)
    {
        for (int i = 0; i < args.Length; i++)
        {
            string a = args[i].ToLowerInvariant();
            if (a == "--quiet") Quiet = true;
            else if (a == "--no-restart") NoRestart = true;
            else if (a == "--no-close") NoClose = true;
            else if (a == "--no-autostart") NoAutostart = true;
            else if (a == "--background") Background = true;
            else if (a == "--once") Once = true;
            else if (a == "--uninstall") Uninstall = true;
            else if (a == "--manifest" && i + 1 < args.Length) { ManifestUrl = args[++i]; CustomManifest = true; }
            else if (a == "--target" && i + 1 < args.Length) Target = Path.GetFullPath(args[++i]);
            else if (a == "--install-dir" && i + 1 < args.Length) InstallDirArg = Path.GetFullPath(args[++i]);
            else if (a == "--data-dir" && i + 1 < args.Length) DataDirArg = Path.GetFullPath(args[++i]);
            else if (a == "--bucket" && i + 1 < args.Length) { int b; if (int.TryParse(args[++i], out b) && b >= 0 && b < 100) BucketArg = b; }
        }
        // GitHub only speaks TLS 1.2 and newer; older .NET Framework setups don't turn it on by themselves.
        try { ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072; } catch { }
        try { Directory.CreateDirectory(InstallDir()); logPath = Path.Combine(InstallDir(), "update.log"); } catch { }

        if (Uninstall) { RemoveAutostart(); Ask("quit"); WriteStatus(null, false, "", false); Console.WriteLine("Automatic updates are off."); return 0; }
        if (Background) return Daemon.Run();
        if (Quiet)
        {
            var r = Setup((msg, pct) => { if (pct <= 0 || pct == 100) Console.WriteLine(pct >= 0 ? msg + " (" + pct + "%)" : msg); });
            Console.WriteLine(r.Message);
            if (r.Launch != null) Launch(r.Launch);
            return r.Ok ? 0 : 1;
        }
        Application.EnableVisualStyles();
        var form = new UpdateForm();
        Application.Run(form);
        return form.Ok ? 0 : 1;
    }

    public class Result { public bool Ok; public string Message; public string Launch; }
    public class Manifest { public string Version, Url, Sha; public long Size; public string UpdUrl, UpdSha, Server; public Manifest Prev; }
    // what the owner's dashboard says (the Web AI server's /live): a gradual rollout, or going back
    public class Gate { public string RollV, Back; public int Pct = 100; }

    public static void Log(string s)
    {
        try
        {
            if (logPath == null) return;
            if (File.Exists(logPath) && new FileInfo(logPath).Length > 200000) File.Delete(logPath);
            File.AppendAllText(logPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss ") + s + Environment.NewLine);
        }
        catch { }
    }

    static bool Allowed(string url)
    {
        if (string.IsNullOrEmpty(url)) return false;
        if (FromRepo.IsMatch(url)) return true;
        return CustomManifest && Loopback.IsMatch(url);   // only for tests run with --manifest on this computer
    }
    static WebClient Client()
    {
        var wc = new WebClient();
        wc.Headers[HttpRequestHeader.UserAgent] = "WebsBrowserUpdater/" + Version;
        wc.Headers[HttpRequestHeader.CacheControl] = "no-cache";
        return wc;
    }

    public static string InstallDir()
    {
        return InstallDirArg ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Webs Browser");
    }
    public static string InboxDir() { return Path.Combine(InstallDir(), "inbox"); }
    public static string SelfPath() { return Path.Combine(InstallDir(), SelfName); }
    static string DataDir() { return DataDirArg ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WebStudiosBrowser"); }

    // ---------------------------------------------------------------- what's new
    public static Manifest ReadManifest()
    {
        if (!Allowed(ManifestUrl)) throw new Exception("The update address is not the browser's own.");
        string json;
        using (var wc = Client()) json = wc.DownloadString(ManifestUrl + (ManifestUrl.Contains("?") ? "&" : "?") + "t=" + DateTime.UtcNow.Ticks / TimeSpan.TicksPerMinute);
        var m = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
        var exe = m.ContainsKey("exe") ? m["exe"] as Dictionary<string, object> : null;
        var upd = m.ContainsKey("updater") ? m["updater"] as Dictionary<string, object> : null;
        var r = new Manifest { Version = Str(m, "version") };
        if (!Regex.IsMatch(r.Version ?? "", @"^\d+\.\d+\.\d+$") || exe == null) throw new Exception("The update information looks wrong.");
        r.Url = Str(exe, "url"); r.Sha = (Str(exe, "sha256") ?? "").ToLowerInvariant();
        long.TryParse(Convert.ToString(exe.ContainsKey("size") ? exe["size"] : "0"), out r.Size);
        if (!Allowed(r.Url)) throw new Exception("The download address is not the browser's own.");
        if (!Regex.IsMatch(r.Sha, "^[0-9a-f]{64}$")) throw new Exception("The update has no checksum, so it can't be checked.");
        if (upd != null && Allowed(Str(upd, "url")) && Regex.IsMatch((Str(upd, "sha256") ?? "").ToLowerInvariant(), "^[0-9a-f]{64}$"))
        { r.UpdUrl = Str(upd, "url"); r.UpdSha = Str(upd, "sha256").ToLowerInvariant(); }
        // the version before, for going back (the same checks as the newest one)
        var prev = Dict(m, "previous"); var pexe = Dict(prev, "exe");
        if (prev != null && pexe != null && Regex.IsMatch(Str(prev, "version") ?? "", @"^\d+\.\d+\.\d+$") && Allowed(Str(pexe, "url")) && Regex.IsMatch((Str(pexe, "sha256") ?? "").ToLowerInvariant(), "^[0-9a-f]{64}$"))
        {
            r.Prev = new Manifest { Version = Str(prev, "version"), Url = Str(pexe, "url"), Sha = Str(pexe, "sha256").ToLowerInvariant() };
            long.TryParse(Convert.ToString(pexe.ContainsKey("size") ? pexe["size"] : "0"), out r.Prev.Size);
        }
        // the Web AI server, which says how the owner wants new versions handed out
        string srv = (Str(Dict(m, "webai"), "server") ?? "").TrimEnd(new[] { '/' });
        if (Regex.IsMatch(srv, @"^https://[^\s/?#]+\.[^\s/?#]+(/[^\s?#]*)?$", RegexOptions.IgnoreCase) || (CustomManifest && Loopback.IsMatch(srv + "/"))) r.Server = srv;
        return r;
    }

    public static Gate ReadGate(Manifest m)
    {
        var g = new Gate();
        if (m == null || m.Server == null) return g;
        try
        {
            var req = (HttpWebRequest)WebRequest.Create(m.Server + "/live");
            req.Timeout = 10000; req.ReadWriteTimeout = 10000; req.UserAgent = "WebsBrowserUpdater/" + Version;
            string json;
            using (var res = req.GetResponse()) using (var sr = new StreamReader(res.GetResponseStream(), Encoding.UTF8)) json = sr.ReadToEnd();
            var d = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
            var w = Dict(Dict(d, "rollout"), "win");
            int pct;
            if (w != null && Regex.IsMatch(Str(w, "v") ?? "", @"^\d+\.\d+\.\d+$") && int.TryParse(Str(w, "pct"), out pct)) { g.RollV = Str(w, "v"); g.Pct = Math.Max(0, Math.Min(100, pct)); }
            string back = Str(Dict(d, "rollback"), "win");
            if (Regex.IsMatch(back ?? "", @"^\d+\.\d+\.\d+$")) g.Back = back;
        }
        catch (Exception e) { Log("server: " + e.Message); }
        return g;
    }
    // which version this computer should have: the newest, the one before (going back), or null: not its turn yet
    public static Manifest Pick(Manifest m, Gate g, bool byItself)
    {
        if (g.Back != null && m.Prev != null && g.Back == m.Prev.Version) return m.Prev;
        if (byItself && g.RollV == m.Version && Bucket() >= g.Pct) return null;
        return m;
    }
    // this computer's place in a gradual rollout, 0 to 99
    public static int Bucket()
    {
        if (BucketArg >= 0) return BucketArg;
        string f = Path.Combine(InstallDir(), "device-id"), id = null;
        try { if (File.Exists(f)) id = File.ReadAllText(f).Trim(); } catch { }
        if (id == null || !Regex.IsMatch(id, "^[0-9a-f]{20,64}$"))
        {
            var b = new byte[15];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(b);
            id = BitConverter.ToString(b).Replace("-", "").ToLowerInvariant();
            try { Directory.CreateDirectory(InstallDir()); File.WriteAllText(f, id); } catch { }
        }
        uint h = 2166136261;
        foreach (char c in id) { h ^= c; h *= 16777619; }
        return (int)(h % 100);
    }

    // downloads and checks a file; returns its path in the temp folder
    static string Fetch(string url, string sha, long size, string name, Action<string, int> say, string what)
    {
        string dir = Path.Combine(Path.GetTempPath(), "WebsBrowserUpdate");
        Directory.CreateDirectory(dir);
        string tmp = Path.Combine(dir, name);
        if (File.Exists(tmp) && Hex(File.ReadAllBytes(tmp)) == sha) return tmp;   // already here from an earlier try
        if (say != null) say(what, 0);
        using (var wc = Client())
        {
            var done = new ManualResetEvent(false);
            Exception err = null;
            wc.DownloadProgressChanged += (s, e) => { long total = e.TotalBytesToReceive > 0 ? e.TotalBytesToReceive : size; if (say != null && total > 0) say(what, (int)Math.Min(100, e.BytesReceived * 100 / total)); };
            wc.DownloadFileCompleted += (s, e) => { err = e.Error; done.Set(); };
            wc.DownloadFileAsync(new Uri(url), tmp);
            if (!done.WaitOne(TimeSpan.FromMinutes(10))) { wc.CancelAsync(); throw new Exception("The download took too long."); }
            if (err != null) throw new Exception("The download failed: " + err.Message);
        }
        var bytes = File.ReadAllBytes(tmp);
        if (size > 0 && bytes.Length != size) { File.Delete(tmp); throw new Exception("The download is the wrong size (" + bytes.Length + " bytes, expected " + size + ")."); }
        if (Hex(bytes) != sha) { File.Delete(tmp); throw new Exception("The download doesn't match its checksum, so it was not installed."); }
        if (bytes.Length < 2 || bytes[0] != 'M' || bytes[1] != 'Z') { File.Delete(tmp); throw new Exception("The download is not a program."); }
        return tmp;
    }

    // where the browser is: the files the running copies started from, and the installed one
    static List<string> Targets(List<KeyValuePair<int, string>> running)
    {
        var targets = new List<string>();
        if (Target != null) { targets.Add(Target); return targets; }
        foreach (var p in running) if (!targets.Any(t => Same(t, p.Value)) && !Path.GetFileName(p.Value).Contains(".old-")) targets.Add(p.Value);
        string inst = Path.Combine(InstallDir(), ExeName);
        if (File.Exists(inst) && !targets.Any(t => Same(t, inst))) targets.Add(inst);
        return targets;
    }
    static string Installed()
    {
        var running = Running();
        return Target ?? running.Select(p => p.Value).FirstOrDefault(p => File.Exists(p) && !Path.GetFileName(p).Contains(".old-")) ?? Path.Combine(InstallDir(), ExeName);
    }

    // Brings the browser up to the newest version. restart: close it (tabs are saved) and open the new one.
    // byItself: the background copy's own round (a gradual rollout waits for this computer's turn)
    public static Manifest Picked; public static bool Waiting, Back;
    public static Result Install(Action<string, int> say, bool restart, bool byItself = false)
    {
        var res = new Result();
        try
        {
            say("Checking for the newest version…", -1);
            var latest = ReadManifest();
            Log("manifest " + latest.Version);
            var gate = ReadGate(latest);
            var m = Pick(latest, gate, byItself);
            Picked = m; Waiting = m == null; Back = m != null && !Eq(m, latest);
            if (m == null)
            {
                Log("rollout of " + latest.Version + " at " + gate.Pct + "%: not this computer's turn yet (" + Bucket() + ")");
                WriteStatus(latest, true, "", false);
                res.Ok = true; res.Message = "Webs Browser " + latest.Version + " comes to this computer soon: it goes to some computers first.";
                return res;
            }
            if (Back) Log("going back to " + m.Version);
            var running = Running();
            var targets = Targets(running);
            bool fresh = targets.Count == 0;
            if (fresh) targets.Add(Path.Combine(InstallDir(), ExeName));
            var stale = targets.Where(t => !File.Exists(t) || Hex(File.ReadAllBytes(t)) != m.Sha).ToList();
            if (stale.Count > 0)
            {
                string tmp = Fetch(m.Url, m.Sha, m.Size, "WebStudiosBrowser-" + m.Version + ".exe", say, "Downloading Webs Browser " + m.Version + "…");
                Log("downloaded and checked " + m.Version);
                say("Installing…", -1);
                foreach (var t in stale) Replace(t, tmp);
                Log("installed to " + string.Join(", ", stale));
                if (fresh && !NoRestart)
                {
                    say("Registering with Windows…", -1);
                    try { var r = Process.Start(new ProcessStartInfo(targets[0], "--register") { UseShellExecute = false }); if (r != null) r.WaitForExit(20000); } catch (Exception e) { Log("register: " + e.Message); }
                }
            }
            WriteStatus(latest, true, "", false);
            var mine = running.Where(p => targets.Any(t => Same(t, p.Value)) || Path.GetFileName(p.Value).Contains(".old-")).Select(p => p.Key).ToList();
            bool closed = true;
            if (restart && mine.Count > 0 && !NoClose)
            {
                say("Closing Webs Browser (your tabs are saved)…", -1);
                closed = CloseAndWait(mine, TimeSpan.FromSeconds(25));
                Log(closed ? "browser closed" : "browser still open");
                // the browser engine's own processes finish closing a moment after the window does
                if (closed) Thread.Sleep(2000);
            }
            res.Ok = true;
            if (stale.Count == 0 && !(restart && mine.Count > 0)) res.Message = "Webs Browser " + m.Version + " is already installed.";
            else if (!closed) res.Message = "Webs Browser " + m.Version + " is installed. It starts the next time you open the browser.";
            else res.Message = "Webs Browser " + m.Version + " is installed.";
            if (!NoRestart && closed && ((restart && mine.Count > 0) || fresh)) res.Launch = targets[0];
        }
        catch (Exception e) { res.Ok = false; res.Message = e.Message; Log("failed: " + e.Message); }
        return res;
    }

    // What opening WebsUpdate.exe does: set up the background copy, then install and open the browser.
    public static Result Setup(Action<string, int> say)
    {
        try
        {
            say("Setting up automatic updates…", -1);
            InstallSelf();
            if (!NoAutostart) AddAutostart();
        }
        catch (Exception e) { Log("setup: " + e.Message); }
        var r = Install(say, true);
        if (r.Ok && !NoAutostart) StartBackground();
        if (r.Ok) r.Message += " From now on it updates by itself.";
        return r;
    }

    // An installer writes the files it installs; this one writes itself to the install folder.
    static void InstallSelf()
    {
        string me = System.Reflection.Assembly.GetExecutingAssembly().Location, dest = SelfPath();
        if (Same(me, dest)) return;
        var bytes = File.ReadAllBytes(me);
        if (File.Exists(dest) && Hex(File.ReadAllBytes(dest)) == Hex(bytes)) return;
        if (BackgroundRunning()) { Ask("quit"); WaitForBackgroundToStop(TimeSpan.FromSeconds(8)); }   // an older background copy steps aside
        string fresh = dest + ".new";
        File.WriteAllBytes(fresh, bytes);
        Replace(dest, fresh);
        try { File.Delete(fresh); } catch { }
        Log("updater " + Version + " installed");
    }
    static void AddAutostart()
    {
        using (var k = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"))
            k.SetValue(RunName, "\"" + SelfPath() + "\" --background");
    }
    static void RemoveAutostart()
    {
        try { using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true)) if (k != null) k.DeleteValue(RunName, false); } catch { }
    }
    // evenIfRunning: a newer copy taking over (it waits for the older one to go)
    public static void StartBackground(bool evenIfRunning = false)
    {
        try
        {
            if (!evenIfRunning && BackgroundRunning()) return;
            var a = "--background" + (CustomManifest ? " --manifest \"" + ManifestUrl + "\"" : "") + (InstallDirArg != null ? " --install-dir \"" + InstallDirArg + "\"" : "") + (DataDirArg != null ? " --data-dir \"" + DataDirArg + "\"" : "");
            var psi = OnWindows ? new ProcessStartInfo(SelfPath(), a) : new ProcessStartInfo("mono", "\"" + SelfPath() + "\" " + a);   // Mono: for tests
            psi.UseShellExecute = false; psi.WorkingDirectory = InstallDir();
            Process.Start(psi);
        }
        catch (Exception e) { Log("start background: " + e.Message); }
    }
    public static string MutexName() { return @"Local\WebsBrowserUpdater-" + Hex(Encoding.UTF8.GetBytes(InstallDir().ToLowerInvariant())).Substring(0, 12); }
    static bool BackgroundRunning()
    {
        try { using (var m = Mutex.OpenExisting(MutexName())) return true; } catch { return false; }
    }
    static void WaitForBackgroundToStop(TimeSpan wait)
    {
        var until = DateTime.UtcNow + wait;
        while (BackgroundRunning() && DateTime.UtcNow < until) Thread.Sleep(200);
    }
    // a request to the background copy, the same way the browser makes them
    static void Ask(string action)
    {
        try { Directory.CreateDirectory(InboxDir()); File.WriteAllText(Path.Combine(InboxDir(), "updater-" + action + ".json"), "{\"action\":\"" + action + "\"}"); } catch { }
    }

    // ---------------------------------------------------------------- telling the browser
    // ui\user in each profile's data folder is served as https://browser.example/user/
    public static void WriteStatus(Manifest m, bool on, string error, bool busy)
    {
        string exe = Installed(), sha = File.Exists(exe) ? Hex(File.ReadAllBytes(exe)) : "";
        var o = new Dictionary<string, object>();
        o["v"] = 1; o["auto"] = on; o["updater"] = Version; o["alive"] = UnixMs(); o["busy"] = busy; o["error"] = error ?? "";
        o["inbox"] = InboxDir(); o["autoInstall"] = AutoInstall();
        o["bucket"] = Bucket();
        if (m != null)
        {
            // what this computer should have: the newest, or the one before when going back
            var t = Eq(Picked, m) || Eq(Picked, m.Prev) ? Picked : Waiting ? null : m;
            o["latest"] = m.Version; o["ready"] = t != null && sha == t.Sha; o["target"] = t != null ? t.Version : "";
            if (t == null) o["wait"] = true;
            else if (!Eq(t, m)) o["back"] = true;
        }
        string json = new JavaScriptSerializer().Serialize(o);
        var dirs = new List<string> { Path.Combine(DataDir(), "ui") };
        try { var pd = Path.Combine(DataDir(), "Profiles"); if (Directory.Exists(pd)) dirs.AddRange(Directory.GetDirectories(pd).Select(d => Path.Combine(d, "ui"))); } catch { }
        foreach (var ui in dirs)
        {
            try
            {
                if (!Directory.Exists(ui)) continue;
                string user = Path.Combine(ui, "user");
                Directory.CreateDirectory(user);
                string f = Path.Combine(user, "webs-update.json");
                if (!on) { if (File.Exists(f)) File.Delete(f); continue; }
                File.WriteAllText(f + ".tmp", json);
                if (File.Exists(f)) File.Delete(f);
                File.Move(f + ".tmp", f);
            }
            catch { }
        }
    }
    // the browser's "Install updates by itself" switch, kept here for the background copy
    public static bool AutoInstall() { try { return !File.Exists(Path.Combine(InstallDir(), "manual-updates")); } catch { return true; } }
    public static void SetAutoInstall(bool on)
    {
        string f = Path.Combine(InstallDir(), "manual-updates");
        try { if (on) { if (File.Exists(f)) File.Delete(f); } else File.WriteAllText(f, "Updates install only when you click Update now in the browser.\r\n"); } catch { }
    }
    static long UnixMs() { return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds; }

    // ---------------------------------------------------------------- helpers
    public static string Str(Dictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) && v != null ? Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture) : null; }
    static bool Eq(Manifest a, Manifest b) { return a != null && b != null && a.Version == b.Version && a.Sha == b.Sha; }
    public static Dictionary<string, object> Dict(Dictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) ? v as Dictionary<string, object> : null; }
    public static string Hex(byte[] b) { using (var h = SHA256.Create()) return BitConverter.ToString(h.ComputeHash(b)).Replace("-", "").ToLowerInvariant(); }
    static bool Same(string a, string b) { try { return string.Equals(Path.GetFullPath(a), Path.GetFullPath(b), StringComparison.OrdinalIgnoreCase); } catch { return false; } }
    public static bool OnWindows { get { return Environment.OSVersion.Platform == PlatformID.Win32NT; } }

    // the running copies of the browser, and the file each runs from
    public static List<KeyValuePair<int, string>> Running()
    {
        var list = new List<KeyValuePair<int, string>>();
        if (!OnWindows) return list;
        foreach (var p in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(ExeName)))
        {
            try
            {
                var sb = new StringBuilder(1024); int n = sb.Capacity;
                IntPtr h = OpenProcess(0x1000, false, p.Id);   // PROCESS_QUERY_LIMITED_INFORMATION
                if (h != IntPtr.Zero)
                {
                    if (QueryFullProcessImageName(h, 0, sb, ref n)) list.Add(new KeyValuePair<int, string>(p.Id, sb.ToString()));
                    CloseHandle(h);
                }
            }
            catch { }
        }
        return list;
    }
    static bool CloseAndWait(List<int> pids, TimeSpan wait)
    {
        if (!OnWindows) return true;
        var set = new HashSet<int>(pids);
        EnumWindows((hwnd, l) =>
        {
            int pid; GetWindowThreadProcessId(hwnd, out pid);
            if (set.Contains(pid) && IsWindowVisible(hwnd)) PostMessage(hwnd, 0x0010, IntPtr.Zero, IntPtr.Zero);   // WM_CLOSE
            return true;
        }, IntPtr.Zero);
        var until = DateTime.UtcNow + wait;
        while (DateTime.UtcNow < until)
        {
            if (pids.All(id => { try { return Process.GetProcessById(id).HasExited; } catch { return true; } })) return true;
            Thread.Sleep(300);
        }
        return false;
    }
    // A running exe can't be overwritten, but it can be renamed: it carries on
    // from the new name and the next start uses the update.
    public static void Replace(string target, string source)
    {
        string dir = Path.GetDirectoryName(target);
        Directory.CreateDirectory(dir);
        string fresh = target + ".new";
        if (!Same(fresh, source)) File.Copy(source, fresh, true);
        string aside = null;
        if (File.Exists(target))
        {
            aside = Path.Combine(dir, Path.GetFileNameWithoutExtension(target) + ".old-" + DateTime.Now.ToString("yyyyMMdd-HHmmss-fff") + ".exe");
            File.Move(target, aside);
        }
        try { File.Move(fresh, target); }
        catch
        {
            if (aside != null && !File.Exists(target)) File.Move(aside, target);   // put the old one back
            throw;
        }
        // copies set aside earlier go once nothing runs from them
        foreach (var old in Directory.GetFiles(dir, Path.GetFileNameWithoutExtension(target) + ".old-*.exe"))
            try { File.Delete(old); } catch { }
    }
    public static void Launch(string exe)
    {
        try { Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(exe) }); }
        catch (Exception e) { Log("launch: " + e.Message); }
    }

    delegate bool EnumProc(IntPtr hwnd, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out int pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder name, ref int size);
}

// The background copy: started with Windows, it checks every few hours and when
// the browser asks, and installs updates by itself. It uses no window.
static class Daemon
{
    static Updater.Manifest last;
    static string lastError = "";
    static readonly DateTime started = DateTime.UtcNow;

    public static int Run()
    {
        bool mine;
        using (var mutex = new Mutex(true, Updater.MutexName(), out mine))
        {
            if (!mine)   // one at a time: a newer copy waits for the older one to go
            {
                try { if (!mutex.WaitOne(Updater.Once ? 0 : 30000)) return 0; }
                catch (AbandonedMutexException) { }   // the older one exited without letting go: it's ours now
            }
            try { Directory.CreateDirectory(Updater.InboxDir()); } catch { }
            Updater.Log("background " + Updater.Version + " started");
            var nextCheck = DateTime.UtcNow.AddSeconds(Updater.Once ? 0 : 90);
            var nextBeat = DateTime.UtcNow;
            while (true)
            {
                foreach (var req in Inbox())
                {
                    if (req == "quit") { Updater.Log("background stopped"); return 0; }
                    if (req == "update" || req == "restart") { Act(true); nextCheck = DateTime.UtcNow.AddHours(3); }
                    else if (req == "check") { Act(false); nextCheck = DateTime.UtcNow.AddHours(3); }
                    else if (req == "auto-on" || req == "auto-off") { Updater.SetAutoInstall(req == "auto-on"); Updater.WriteStatus(last, true, lastError, false); }
                }
                if (DateTime.UtcNow >= nextCheck) { Act(false); nextCheck = DateTime.UtcNow.AddHours(3); }
                if (DateTime.UtcNow >= nextBeat) { Updater.WriteStatus(last, true, lastError, false); nextBeat = DateTime.UtcNow.AddMinutes(4); }
                if (Updater.Once) return 0;
                Thread.Sleep(1500);
            }
        }
    }

    // requests the browser (or a newer copy of this program) left in the inbox, oldest first
    static List<string> Inbox()
    {
        var list = new List<string>();
        try
        {
            foreach (var f in new DirectoryInfo(Updater.InboxDir()).GetFiles("*.json").OrderBy(x => x.LastWriteTimeUtc))
            {
                string action = "";
                try
                {
                    var d = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(f.FullName));
                    action = (Updater.Str(d, "action") ?? "").ToLowerInvariant();
                }
                catch { }
                try { f.Delete(); } catch { }
                if (action == "" || DateTime.UtcNow - f.LastWriteTimeUtc > TimeSpan.FromMinutes(10)) continue;   // too old to act on
                if (action == "quit" && f.LastWriteTimeUtc < started.AddSeconds(-2)) continue;                  // meant for a copy that already went
                list.Add(action);
            }
        }
        catch { }
        return list;
    }

    // check, keep the updater itself current, install a new browser; restart: when the browser asked
    static void Act(bool restart)
    {
        try
        {
            Updater.WriteStatus(last, true, "", true);
            last = Updater.ReadManifest();
            if (SelfUpdate(last)) Environment.Exit(0);
            if (!restart && !Updater.AutoInstall()) { Updater.WriteStatus(last, true, "", false); return; }   // switched off in the browser: only when asked
            var r = Updater.Install((msg, pct) => { }, restart, !restart);
            lastError = r.Ok ? "" : r.Message;
            Updater.WriteStatus(last, true, lastError, false);
            if (r.Launch != null) Updater.Launch(r.Launch);
            Updater.Log((restart ? "update: " : "check: ") + r.Message);
        }
        catch (Exception e) { lastError = e.Message; Updater.WriteStatus(last, true, lastError, false); Updater.Log("check failed: " + e.Message); }
    }

    // a newer updater: put it in place and hand over to it
    static bool SelfUpdate(Updater.Manifest m)
    {
        if (m.UpdUrl == null) return false;
        string self = Updater.SelfPath();
        if (!File.Exists(self) || Updater.Hex(File.ReadAllBytes(self)) == m.UpdSha) return false;
        try
        {
            var dir = Path.Combine(Path.GetTempPath(), "WebsBrowserUpdate");
            Directory.CreateDirectory(dir);
            string tmp = Path.Combine(dir, "WebsUpdate-new.exe");
            using (var wc = new WebClient()) { wc.Headers[HttpRequestHeader.UserAgent] = "WebsBrowserUpdater/" + Updater.Version; wc.DownloadFile(m.UpdUrl, tmp); }
            var b = File.ReadAllBytes(tmp);
            if (Updater.Hex(b) != m.UpdSha || b.Length < 2 || b[0] != 'M' || b[1] != 'Z') { Updater.Log("new updater didn't match its checksum"); return false; }
            Updater.Replace(self, tmp);
            Updater.StartBackground(true);
            Updater.Log("updater replaced by a newer one");
            return true;
        }
        catch (Exception e) { Updater.Log("self update: " + e.Message); return false; }
    }
}

class UpdateForm : Form
{
    public bool Ok;
    readonly Label title = new Label(), status = new Label();
    readonly ProgressBar bar = new ProgressBar();
    readonly Button button = new Button();

    public UpdateForm()
    {
        Text = "Webs Browser";
        FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = true;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(440, 150);
        BackColor = Color.FromArgb(22, 19, 26); ForeColor = Color.FromArgb(243, 239, 241);
        Font = new Font("Segoe UI", 9.5f);
        title.Text = "Installing Webs Browser"; title.Font = new Font("Segoe UI Semibold", 13f);
        title.SetBounds(20, 16, 400, 28);
        status.SetBounds(20, 48, 400, 40); status.ForeColor = Color.FromArgb(154, 145, 163);
        bar.SetBounds(20, 92, 400, 8); bar.Style = ProgressBarStyle.Marquee; bar.MarqueeAnimationSpeed = 30;
        button.Text = "Cancel"; button.SetBounds(320, 110, 100, 30); button.FlatStyle = FlatStyle.Flat;
        button.BackColor = Color.FromArgb(39, 34, 48); button.FlatAppearance.BorderColor = Color.FromArgb(58, 51, 66);
        button.Click += (s, e) => Close();
        Controls.AddRange(new Control[] { title, status, bar, button });
        Shown += (s, e) => new Thread(Work) { IsBackground = true }.Start();
    }

    void Say(string msg, int pct)
    {
        if (IsDisposed) return;
        BeginInvoke((Action)(() =>
        {
            status.Text = msg;
            if (pct >= 0) { bar.Style = ProgressBarStyle.Continuous; bar.Value = Math.Max(0, Math.Min(100, pct)); }
            else bar.Style = ProgressBarStyle.Marquee;
        }));
    }

    void Work()
    {
        var r = Updater.Setup(Say);
        if (IsDisposed) return;
        BeginInvoke((Action)(() =>
        {
            Ok = r.Ok;
            title.Text = r.Ok ? "Done" : "It didn't install";
            status.Text = r.Message + (r.Ok ? "" : " Your browser was not changed.");
            bar.Style = ProgressBarStyle.Continuous; bar.Value = r.Ok ? 100 : 0;
            button.Text = "Close";
            if (r.Launch != null)
            {
                Updater.Launch(r.Launch);
                var t = new System.Windows.Forms.Timer { Interval = 3000 };
                t.Tick += (s, e) => { t.Stop(); Close(); };
                t.Start();
            }
        }));
    }
}
