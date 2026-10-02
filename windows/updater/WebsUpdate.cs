// WebsUpdate.exe: installs the newest Webs Browser.
//
// The browser downloads this small program when you click "Update now" and
// opens it. It reads updates/latest.json from the browser's GitHub repository,
// downloads the new WebStudiosBrowser.exe, checks it against the SHA-256 in that
// file, closes the browser (the way clicking X does, so your tabs are saved),
// puts the new exe where the old one was, and opens it again.
//
// Run on a computer without Webs Browser, it installs it the way install.ps1
// does: to %LOCALAPPDATA%\Programs\Webs Browser, registered with Windows.
//
// Build: csc /target:winexe /r:System.Web.Extensions.dll WebsUpdate.cs
//    or: mcs -target:winexe -r:System.Web.Extensions -r:System.Windows.Forms -r:System.Drawing WebsUpdate.cs
//
// Options (mostly for testing): --quiet (no window), --manifest <url>,
// --target <exe path>, --no-restart, --no-close.
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

[assembly: System.Reflection.AssemblyTitle("Webs Browser updater")]
[assembly: System.Reflection.AssemblyProduct("Webs Browser")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

static class Updater
{
    const string DefaultManifest = "https://raw.githubusercontent.com/spiderkingfr-eng/Webs-Browser/main/updates/latest.json";
    const string ExeName = "WebStudiosBrowser.exe";
    static readonly Regex FromRepo = new Regex(@"^https://(raw\.githubusercontent\.com|github\.com)/spiderkingfr-eng/Webs-Browser/", RegexOptions.IgnoreCase);
    static readonly Regex Loopback = new Regex(@"^http://(127\.0\.0\.1|localhost)(:\d+)?/", RegexOptions.IgnoreCase);

    public static bool Quiet, NoRestart, NoClose, CustomManifest;
    public static string ManifestUrl = DefaultManifest, Target;
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
            else if (a == "--manifest" && i + 1 < args.Length) { ManifestUrl = args[++i]; CustomManifest = true; }
            else if (a == "--target" && i + 1 < args.Length) Target = Path.GetFullPath(args[++i]);
        }
        // GitHub only speaks TLS 1.2 and newer; older .NET Framework setups don't turn it on by themselves.
        try { ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072; } catch { }
        if (Quiet)
        {
            var r = Run((msg, pct) => { if (pct <= 0 || pct == 100) Console.WriteLine(pct >= 0 ? msg + " (" + pct + "%)" : msg); });
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

    static void Log(string s)
    {
        try { if (logPath != null) File.AppendAllText(logPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss ") + s + Environment.NewLine); } catch { }
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
        wc.Headers[HttpRequestHeader.UserAgent] = "WebsBrowserUpdater/1.0";
        wc.Headers[HttpRequestHeader.CacheControl] = "no-cache";
        return wc;
    }

    public static string InstallDir()
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Webs Browser");
    }

    public static Result Run(Action<string, int> say)
    {
        var res = new Result();
        try
        {
            Directory.CreateDirectory(InstallDir());
            logPath = Path.Combine(InstallDir(), "update.log");
        }
        catch { }
        try
        {
            // 1. what the newest version is
            say("Checking for the newest version…", -1);
            if (!Allowed(ManifestUrl)) throw new Exception("The update address is not the browser's own.");
            string json;
            using (var wc = Client()) json = wc.DownloadString(ManifestUrl + (ManifestUrl.Contains("?") ? "&" : "?") + "t=" + DateTime.UtcNow.Ticks / TimeSpan.TicksPerMinute);
            var m = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
            string version = Str(m, "version");
            var exe = m.ContainsKey("exe") ? m["exe"] as Dictionary<string, object> : null;
            if (!Regex.IsMatch(version ?? "", @"^\d+\.\d+\.\d+$") || exe == null) throw new Exception("The update information looks wrong.");
            string url = Str(exe, "url"), sha = (Str(exe, "sha256") ?? "").ToLowerInvariant();
            long size = 0; long.TryParse(Convert.ToString(exe.ContainsKey("size") ? exe["size"] : "0"), out size);
            if (!Allowed(url)) throw new Exception("The download address is not the browser's own.");
            if (!Regex.IsMatch(sha, "^[0-9a-f]{64}$")) throw new Exception("The update has no checksum, so it can't be checked.");
            Log("manifest " + version + " " + url);

            // 2. where the browser is, and whether it is already this version
            var running = Running();
            var targets = new List<string>();
            if (Target != null) targets.Add(Target);
            else
            {
                foreach (var p in running) if (!targets.Any(t => Same(t, p.Value))) targets.Add(p.Value);
                string inst = Path.Combine(InstallDir(), ExeName);
                if (File.Exists(inst) && !targets.Any(t => Same(t, inst))) targets.Add(inst);
            }
            bool fresh = targets.Count == 0;
            if (fresh) targets.Add(Path.Combine(InstallDir(), ExeName));
            targets = targets.Where(t => !File.Exists(t) || Hex(File.ReadAllBytes(t)) != sha).ToList();
            if (targets.Count == 0)
            {
                res.Ok = true; res.Message = "Webs Browser " + version + " is already installed.";
                return res;
            }

            // 3. download it and check it
            string tmpDir = Path.Combine(Path.GetTempPath(), "WebsBrowserUpdate");
            Directory.CreateDirectory(tmpDir);
            string tmp = Path.Combine(tmpDir, "WebStudiosBrowser-" + version + ".exe");
            say("Downloading Webs Browser " + version + "…", 0);
            using (var wc = Client())
            {
                var done = new ManualResetEvent(false);
                Exception err = null;
                wc.DownloadProgressChanged += (s, e) => { long total = e.TotalBytesToReceive > 0 ? e.TotalBytesToReceive : size; if (total > 0) say("Downloading Webs Browser " + version + "…", (int)Math.Min(100, e.BytesReceived * 100 / total)); };
                wc.DownloadFileCompleted += (s, e) => { err = e.Error; done.Set(); };
                wc.DownloadFileAsync(new Uri(url), tmp);
                if (!done.WaitOne(TimeSpan.FromMinutes(10))) { wc.CancelAsync(); throw new Exception("The download took too long."); }
                if (err != null) throw new Exception("The download failed: " + err.Message);
            }
            var bytes = File.ReadAllBytes(tmp);
            if (size > 0 && bytes.Length != size) throw new Exception("The download is the wrong size (" + bytes.Length + " bytes, expected " + size + ").");
            if (Hex(bytes) != sha) throw new Exception("The download doesn't match its checksum, so it was not installed.");
            if (bytes.Length < 2 || bytes[0] != 'M' || bytes[1] != 'Z') throw new Exception("The download is not a program.");
            Log("downloaded and checked " + bytes.Length + " bytes");

            // 4. close it the way the X button does, so it saves your tabs
            bool closed = true;
            var mine = running.Where(p => targets.Any(t => Same(t, p.Value))).Select(p => p.Key).ToList();
            if (mine.Count > 0 && !NoClose)
            {
                say("Closing Webs Browser (your tabs are saved)…", -1);
                closed = CloseAndWait(mine, TimeSpan.FromSeconds(25));
                Log(closed ? "browser closed" : "browser still open");
            }

            // 5. put the new one in place
            say("Installing…", -1);
            foreach (var t in targets) Replace(t, tmp);
            try { File.Delete(tmp); } catch { }
            Log("installed to " + string.Join(", ", targets));

            if (fresh && !NoRestart)
            {
                say("Registering with Windows…", -1);
                try { var r = Process.Start(new ProcessStartInfo(targets[0], "--register") { UseShellExecute = false }); if (r != null) r.WaitForExit(20000); } catch (Exception e) { Log("register: " + e.Message); }
            }
            res.Ok = true;
            if (!closed)
            {
                res.Message = "Webs Browser " + version + " is installed. It starts the next time you open the browser.";
            }
            else
            {
                res.Message = "Webs Browser " + version + " is installed.";
                if (!NoRestart && (mine.Count > 0 || fresh)) res.Launch = targets[0];
            }
        }
        catch (Exception e)
        {
            res.Ok = false;
            res.Message = e.Message;
            Log("failed: " + e);
        }
        return res;
    }

    static string Str(Dictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) && v != null ? Convert.ToString(v) : null; }

    static string Hex(byte[] b)
    {
        using (var h = SHA256.Create()) return BitConverter.ToString(h.ComputeHash(b)).Replace("-", "").ToLowerInvariant();
    }

    static bool Same(string a, string b)
    {
        try { return string.Equals(Path.GetFullPath(a), Path.GetFullPath(b), StringComparison.OrdinalIgnoreCase); } catch { return false; }
    }

    static bool OnWindows { get { return Environment.OSVersion.Platform == PlatformID.Win32NT; } }

    // the running copies of the browser, and the file each runs from
    static List<KeyValuePair<int, string>> Running()
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
    static void Replace(string target, string source)
    {
        string dir = Path.GetDirectoryName(target);
        Directory.CreateDirectory(dir);
        string fresh = target + ".new";
        File.Copy(source, fresh, true);
        string aside = null;
        if (File.Exists(target))
        {
            aside = Path.Combine(dir, Path.GetFileNameWithoutExtension(target) + ".old-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".exe");
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

class UpdateForm : Form
{
    public bool Ok;
    readonly Label title = new Label(), status = new Label();
    readonly ProgressBar bar = new ProgressBar();
    readonly Button button = new Button();

    public UpdateForm()
    {
        Text = "Webs Browser update";
        FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = true;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(440, 150);
        BackColor = Color.FromArgb(22, 19, 26); ForeColor = Color.FromArgb(243, 239, 241);
        Font = new Font("Segoe UI", 9.5f);
        title.Text = "Updating Webs Browser"; title.Font = new Font("Segoe UI Semibold", 13f);
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
        var r = Updater.Run(Say);
        if (IsDisposed) return;
        BeginInvoke((Action)(() =>
        {
            Ok = r.Ok;
            title.Text = r.Ok ? "Done" : "The update didn't install";
            status.Text = r.Message + (r.Ok ? "" : " Your browser was not changed.");
            bar.Style = ProgressBarStyle.Continuous; bar.Value = r.Ok ? 100 : 0;
            button.Text = r.Launch != null ? "Open it now" : "Close";
            if (r.Launch != null)
            {
                Updater.Launch(r.Launch);
                button.Text = "Close";
                var t = new System.Windows.Forms.Timer { Interval = 2500 };
                t.Tick += (s, e) => { t.Stop(); Close(); };
                t.Start();
            }
        }));
    }
}
