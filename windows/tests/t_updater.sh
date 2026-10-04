#!/bin/sh
# The updater under Mono, in a sandbox (its own install and data folders, a local
# update server): first setup, background installs, the browser's requests
# through the inbox, the "install by itself" switch, checksums, foreign
# addresses, a newer updater replacing itself, a gradual rollout and going back
# (2.1, from the Web AI server's /live), and switching it off.
cd "$(dirname "$0")/.."
U=$PWD/out/WebsUpdate-test.exe; U2=$PWD/out/WebsUpdate-test2.exe
# built the way it's published: against the .NET Framework 4.8 reference assemblies (updater/compile.py)
python3 updater/compile.py updater/WebsUpdate.cs $U || exit 1
sed 's/public const string Version = "\([0-9.]*\)";/public const string Version = "\1-next";/' updater/WebsUpdate.cs > out/WebsUpdate-next.cs
python3 updater/compile.py out/WebsUpdate-next.cs $U2 || exit 1
# nothing Windows lacks: every method it calls exists in the .NET Framework 4.8 reference assemblies
monodis --memberref $U 2>/dev/null | grep -q "string(char)" && { echo "FAIL calls a method only Mono has"; exit 1; }
T=$(mktemp -d); mkdir -p $T/srv $T/app $T/inst $T/data/ui $T/data/Profiles/Work/ui
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
URL=http://127.0.0.1:$PORT
printf 'MZ old version' > $T/app/WebStudiosBrowser.exe
for v in 1 2 3 4 5; do printf "MZ browser version $v %0500d" 0 > $T/srv/b$v.exe; done
cp $U $T/srv/upd.exe; cp $U2 $T/srv/upd2.exe
sha() { sha256sum "$1" | cut -d' ' -f1; }
manifest() {   # version, browser file, updater file, (sha override)
  printf '{"version":"%s","exe":{"url":"%s/%s","sha256":"%s","size":%s},"updater":{"url":"%s/%s","sha256":"%s"}}' \
    "$1" $URL "$2" "${4:-$(sha $T/srv/$2)}" $(stat -c %s $T/srv/$2) $URL "$3" "$(sha $T/srv/$3)" > $T/srv/latest.json
}
manifest2() {   # version, browser file, previous version, previous file, server
  printf '{"version":"%s","exe":{"url":"%s/%s","sha256":"%s","size":%s},"updater":{"url":"%s/upd2.exe","sha256":"%s"},"previous":{"version":"%s","exe":{"url":"%s/%s","sha256":"%s","size":%s}},"webai":{"server":"%s"}}' \
    "$1" $URL "$2" "$(sha $T/srv/$2)" $(stat -c %s $T/srv/$2) $URL "$(sha $T/srv/upd2.exe)" "$3" $URL "$4" "$(sha $T/srv/$4)" $(stat -c %s $T/srv/$4) "$5" > $T/srv/latest.json
}
live() { printf '%s' "$1" > $T/srv/live; }
(cd $T/srv && exec python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1) & SRV=$!
sleep 1; fail=0
ok() { echo "PASS $1"; }; no() { echo "FAIL $1"; fail=1; }
COMMON="--manifest $URL/latest.json --install-dir $T/inst --data-dir $T/data --target $T/app/WebStudiosBrowser.exe"
run() { HOME=$T mono "$@" >$T/out.txt 2>&1; }
status() { python3 -c "import json,sys; d=json.load(open('$T/data/ui/user/webs-update.json')); print(d.get('$1'))" 2>/dev/null; }
ask() { printf '{"action":"%s","from":"3.2.0"}' "$1" > "$T/inst/inbox/Webs Browser sync - PC.json"; }

# 1. a wrong checksum changes nothing
manifest 9.0.1 b1.exe upd.exe 0000000000000000000000000000000000000000000000000000000000000000
run $U --quiet --no-autostart --no-restart $COMMON
grep -q checksum $T/out.txt && [ "$(cat $T/app/WebStudiosBrowser.exe)" = "MZ old version" ] && ok "wrong checksum changes nothing" || no "wrong checksum"
# 2. first setup: the updater installs itself, the browser is updated, the browser is told
manifest 9.0.1 b1.exe upd.exe
run $U --quiet --no-autostart --no-restart $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b1.exe)" ] && ok "setup installs the browser" || { no "setup install"; cat $T/out.txt; }
[ "$(sha $T/inst/WebsUpdate.exe)" = "$(sha $U)" ] && ok "setup installs the updater" || no "updater installed"
[ "$(status ready)" = "True" ] && [ "$(status latest)" = "9.0.1" ] && [ "$(status auto)" = "True" ] && ok "status file for the browser" || no "status file"
[ -f $T/data/Profiles/Work/ui/user/webs-update.json ] && ok "status for other profiles too" || no "profile status"
grep -q "updates by itself" $T/out.txt && ok "says it updates by itself from now on" || no "setup message"
# 3. a new version: the background round installs it without being asked
manifest 9.0.2 b2.exe upd.exe
run $T/inst/WebsUpdate.exe --background --once $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b2.exe)" ] && [ "$(status latest)" = "9.0.2" ] && ok "background installs a new version" || { no "background install"; tail -3 $T/inst/update.log; }
# 4. switched off in the browser: it only tells; the browser's Update now installs it
ask auto-off; run $T/inst/WebsUpdate.exe --background --once $COMMON
[ "$(status autoInstall)" = "False" ] && ok "install-by-itself switch reaches it" || no "auto-off"
manifest 9.0.3 b3.exe upd.exe
run $T/inst/WebsUpdate.exe --background --once $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b2.exe)" ] && [ "$(status ready)" = "False" ] && [ "$(status latest)" = "9.0.3" ] && ok "switched off: tells, doesn't install" || no "auto-off respected"
ask update; run $T/inst/WebsUpdate.exe --background --once $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b3.exe)" ] && [ "$(status ready)" = "True" ] && ok "the browser's Update now installs it" || no "inbox update"
[ ! -f "$T/inst/inbox/Webs Browser sync - PC.json" ] && ok "requests are used up" || no "request left"
ask auto-on; run $T/inst/WebsUpdate.exe --background --once $COMMON; [ "$(status autoInstall)" = "True" ] && ok "switched back on" || no "auto-on"
# 5. an address outside the repository is refused
printf '{"version":"9.9.9","exe":{"url":"https://elsewhere.example/x.exe","sha256":"%s"}}' "$(sha $T/srv/b1.exe)" > $T/srv/latest.json
run $T/inst/WebsUpdate.exe --background --once $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b3.exe)" ] && grep -q "not the browser's own" $T/inst/update.log && ok "foreign address refused" || no "foreign address"
# 6. a newer updater replaces itself and hands over
manifest 9.0.3 b3.exe upd2.exe
run $T/inst/WebsUpdate.exe --background --once $COMMON; sleep 2
[ "$(sha $T/inst/WebsUpdate.exe)" = "$(sha $U2)" ] && ok "updater updates itself" || no "self update"
pkill -f "install-dir $T/inst" 2>/dev/null; sleep 1
# 8. a gradual rollout to 30%: a computer numbered 50 waits, and says so
manifest2 9.0.4 b4.exe 9.0.3 b3.exe $URL
live '{"ok":true,"rollout":{"win":{"v":"9.0.4","pct":30}}}'
run $T/inst/WebsUpdate.exe --background --once --bucket 50 $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b3.exe)" ] && [ "$(status wait)" = "True" ] && [ "$(status bucket)" = "50" ] && [ "$(status latest)" = "9.0.4" ] && grep -q "not this computer's turn" $T/inst/update.log \
  && ok "rollout: not this computer's turn yet" || { no "rollout wait"; tail -3 $T/inst/update.log; }
# 9. ... one numbered 10 gets it by itself
cp $T/app/WebStudiosBrowser.exe $T/b3copy.exe
run $T/inst/WebsUpdate.exe --background --once --bucket 10 $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b4.exe)" ] && [ "$(status ready)" = "True" ] && [ "$(status target)" = "9.0.4" ] && ok "rollout: a computer in it gets it" || no "rollout in"
# 10. asking for it in the browser installs it at once, turn or not
cp $T/b3copy.exe $T/app/WebStudiosBrowser.exe
ask update; run $T/inst/WebsUpdate.exe --background --once --bucket 50 $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b4.exe)" ] && ok "rollout: Update now installs it anyway" || no "rollout explicit"
# 11. going back: every computer is put on the version before (checked against its own checksum)
live '{"ok":true,"rollback":{"win":"9.0.3"},"rollout":{"win":{"v":"9.0.4","pct":30}}}'
run $T/inst/WebsUpdate.exe --background --once --bucket 50 $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b3.exe)" ] && [ "$(status target)" = "9.0.3" ] && [ "$(status back)" = "True" ] && [ "$(status ready)" = "True" ] && grep -q "going back to 9.0.3" $T/inst/update.log \
  && ok "going back installs the version before" || { no "rollback"; tail -3 $T/inst/update.log; }
ask update; run $T/inst/WebsUpdate.exe --background --once --bucket 10 $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b3.exe)" ] && ok "going back: Update now keeps the version before" || no "rollback explicit"
# 12. going back only to the version latest.json names as the one before
live '{"ok":true,"rollback":{"win":"9.0.1"}}'
run $T/inst/WebsUpdate.exe --background --once --bucket 50 $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b4.exe)" ] && [ "$(status back)" = "None" ] && ok "an unknown version to go back to is ignored" || no "rollback unknown"
# 13. a server that can't be reached: updates work as before
manifest2 9.0.5 b5.exe 9.0.4 b4.exe http://127.0.0.1:9
run $T/inst/WebsUpdate.exe --background --once --bucket 99 $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b5.exe)" ] && ok "no server: updates as before" || no "server down"
# 14. a broken "previous" is left out
printf '{"version":"9.0.5","exe":{"url":"%s/b5.exe","sha256":"%s"},"updater":{"url":"%s/upd2.exe","sha256":"%s"},"previous":{"version":"9.0.4","exe":{"url":"https://elsewhere.example/b4.exe","sha256":"%s"}},"webai":{"server":"%s"}}' \
  $URL "$(sha $T/srv/b5.exe)" $URL "$(sha $T/srv/upd2.exe)" "$(sha $T/srv/b4.exe)" $URL > $T/srv/latest.json
live '{"ok":true,"rollback":{"win":"9.0.4"}}'
run $T/inst/WebsUpdate.exe --background --once --bucket 50 $COMMON
[ "$(sha $T/app/WebStudiosBrowser.exe)" = "$(sha $T/srv/b5.exe)" ] && ok "a previous version from elsewhere is never installed" || no "foreign previous"
# 7. switching it off
run $T/inst/WebsUpdate.exe --uninstall $COMMON
[ ! -f $T/data/ui/user/webs-update.json ] && [ -f $T/inst/inbox/updater-quit.json ] && ok "uninstall stops it and tells the browser" || no "uninstall"
kill $SRV 2>/dev/null; rm -rf $T $U $U2 out/WebsUpdate-next.cs
exit $fail
