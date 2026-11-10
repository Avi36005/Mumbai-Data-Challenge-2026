#!/bin/bash
# AirPulse daily update: newest NOAA GFS runs -> weather-engine forecast -> 24 wards -> tests -> Firebase deploy -> GitHub push.
# Usage (from anywhere):  bash "airpulse_city/daily_update.sh"        Log: airpulse_city/logs/
# The submitted 11-12 Nov competition forecast is never changed; each run only adds the newest complete days.
set -euo pipefail
P="$(cd "$(dirname "$0")/.." && pwd)"; CM="$P/competition_model"; PY="$CM/.venv-model/bin/python"; WPY="$CM/.venv-weather/bin/python"
PKG="$P/Google_Mumbai_Data_Challenge_FINAL_2026-11-10"; WD=external/gfs/refreshed_daily; DEP="$P/airpulse_deploy"; SITE="$P/airpulse_city/site"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"; export MUMBAI_THREADS=3
mkdir -p "$P/airpulse_city/logs"; LOG="$P/airpulse_city/logs/$(date +%Y-%m-%d_%H%M).log"; exec > >(tee -a "$LOG") 2>&1
echo "== AirPulse daily update $(date '+%Y-%m-%d %H:%M %Z')"
cd "$CM"
S=$(date -v-2d +%Y-%m-%d); E=$(date +%Y-%m-%d)
echo "[1/6] NOAA GFS runs $S .. $E (00Z and 12Z)"
for h in 0 12; do "$WPY" tools/gfs_weather.py archive --start "$S" --end "$E" --origin-hour $h --part daily_$h 2>&1 | tail -2; done
echo "[2/6] decode station weather tables -> $WD"
"$WPY" tools/refresh_weather.py --stations "$PKG/data/Stations.csv" --output-dir $WD 2>&1 | tail -2
echo "[3/6] weather-engine forecast (4 stations)"
"$PY" "$P/airpulse_city/wx_engine.py" forecast $WD/station_values_ext_verified.csv.gz 2>&1 | grep -v Warn
echo "[4/6] spread to 24 wards"
"$PY" "$P/airpulse_city/build_city.py" 2>&1 | grep -E "forecast days|wrote"
echo "[5/6] sync site and run the browser tests"
rsync -a --exclude _test --exclude .DS_Store "$SITE/" "$DEP/"; mkdir -p "$DEP/tests"; cp "$SITE/_test/run.html" "$DEP/tests/run.html"
V=$(date +%Y%m%d%H%M); sed -i '' -E "s#(app\.css|i18n\.js|app\.js)\?v=[0-9a-z]+#\1?v=$V#g" "$DEP/index.html"; sed -i '' -E "s#const CACHE = 'airpulse-[0-9a-z]+';#const CACHE = 'airpulse-$V';#; s#\?v=[0-9a-z]+'#?v=$V'#g" "$DEP/sw.js"
( cd "$DEP" && python3 -m http.server 8799 >/dev/null 2>&1 & echo $! > /tmp/airpulse_test_server.pid ); sleep 1
RES=$("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1400,1000 --virtual-time-budget=90000 --dump-dom "http://localhost:8799/tests/run.html" 2>/dev/null | grep -o "RESULT: [0-9]* passed, [0-9]* failed" || true)
kill "$(cat /tmp/airpulse_test_server.pid)" 2>/dev/null || true; echo "tests: ${RES:-not run}"
case "$RES" in *", 0 failed") ;; *) echo "STOP: tests did not pass, nothing deployed"; exit 1;; esac
echo "[6/6] deploy to Firebase and push to GitHub"
cd "$DEP" && npx -y firebase-tools@latest deploy --only hosting --project airpulse-mumbai-2026 --account avinashgehi3@gmail.com --non-interactive 2>&1 | grep -E "Deploy complete|Error" | sed 's/\x1b\[[0-9;]*m//g'
git add -A && git commit -q -m "Daily forecast update $(date '+%Y-%m-%d %H:%M IST')" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push -q origin main || echo "nothing new to commit"
echo "== done $(date '+%H:%M')  https://airpulse-mumbai-2026.web.app"
