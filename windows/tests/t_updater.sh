#!/bin/sh
# The updater, under Mono: a good update installs; a wrong checksum or an address
# outside the repository changes nothing; an up-to-date copy isn't downloaded again.
set -e
cd "$(dirname "$0")/.."
U=$PWD/out/WebsUpdate-test.exe
mcs -target:winexe -r:System.Web.Extensions -r:System.Windows.Forms -r:System.Drawing -out:$U updater/WebsUpdate.cs
T=$(mktemp -d); mkdir -p $T/srv $T/app $T/home
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
NEW=$(ls ../updates/WebStudiosBrowser-*.exe | tail -1)
cp "$NEW" $T/srv/new.exe; printf 'MZ old version' > $T/app/WebStudiosBrowser.exe
SHA=$(sha256sum $T/srv/new.exe | cut -d' ' -f1); SIZE=$(stat -c %s $T/srv/new.exe)
printf '{"version":"9.0.0","exe":{"url":"http://127.0.0.1:'"$PORT"'/new.exe","sha256":"%s","size":%s}}' $SHA $SIZE > $T/srv/good.json
printf '{"version":"9.0.0","exe":{"url":"http://127.0.0.1:'"$PORT"'/new.exe","sha256":"%064d","size":%s}}' 0 $SIZE > $T/srv/bad.json
printf '{"version":"9.0.0","exe":{"url":"https://elsewhere.example/new.exe","sha256":"%s"}}' $SHA > $T/srv/foreign.json
(cd $T/srv && exec python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1) & SRV=$!
sleep 1; fail=0
run() { HOME=$T/home mono $U --quiet --no-restart --manifest http://127.0.0.1:$PORT/$1 --target $T/app/WebStudiosBrowser.exe >$T/out.txt 2>&1 && echo ok || echo failed; }
r=$(run bad.json);     [ "$r" = failed ] && grep -q "checksum" $T/out.txt && [ "$(cat $T/app/WebStudiosBrowser.exe)" = "MZ old version" ] && echo "PASS wrong checksum changes nothing" || { echo "FAIL wrong checksum"; fail=1; }
r=$(run foreign.json); [ "$r" = failed ] && grep -q "not the browser's own" $T/out.txt && echo "PASS foreign address refused" || { echo "FAIL foreign address"; fail=1; }
r=$(run good.json);    [ "$r" = ok ] && [ "$(sha256sum $T/app/WebStudiosBrowser.exe | cut -d' ' -f1)" = "$SHA" ] && echo "PASS update installed" || { echo "FAIL update"; fail=1; }
r=$(run good.json);    [ "$r" = ok ] && grep -q "already installed" $T/out.txt && ! grep -q Downloading $T/out.txt && echo "PASS up to date, nothing downloaded" || { echo "FAIL up to date"; fail=1; }
kill $SRV; rm -rf $T $U
exit $fail
