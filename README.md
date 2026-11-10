# AirPulse Mumbai

**Tomorrow's air for every Mumbai ward: when to go out, who is exposed, and how far to trust it.**

Built by team **Kryptonite** for the Google Mumbai Data Challenge 2026 (Zindi), creative-submission category.

## 🔗 Live app: **https://airpulse-mumbai-2026.web.app**

| Open directly in | Link |
|---|---|
| English | https://airpulse-mumbai-2026.web.app/?lang=en |
| हिंदी (Hindi) | https://airpulse-mumbai-2026.web.app/?lang=hi |
| मराठी (Marathi) | https://airpulse-mumbai-2026.web.app/?lang=mr |
| A specific ward, e.g. Govandi · Mankhurd at 1 am | https://airpulse-mumbai-2026.web.app/?ward=ME&hour=1 |
| Full evidence dashboard | https://airpulse-mumbai-2026.web.app/evidence/ |

Works on any phone browser; no install, no sign-in.

Air-quality apps usually show one number for one station. AirPulse turns a forecast for four official stations into something every family in Mumbai can use: a forecast for all 24 BMC wards, a plan for your day, and a picture to send to the family WhatsApp group, in English, Hindi or Marathi.

## What it does

A white, single-page dashboard (DM Sans; Noto Sans Devanagari for Hindi and Marathi). Pick an area, a day and an hour at the top; every panel updates.

| Panel | What you get |
|---|---|
| **Controls** | Area (24 BMC wards, or "use my location"), day, hour slider with play-through |
| **Key numbers** | PM2.5 at the chosen hour with its CPCB category and the smoky-nights value, day average, cigarette equivalent (Berkeley Earth: 22 µg/m³ over 24 h ≈ 1 cigarette), cleanest hour, worst hour |
| **Hour by hour** | Chart of the expected PM2.5 and the higher path if Diwali smoke lingers, on the CPCB colour bands; click to pick an hour; read aloud with **Listen** |
| **Who is breathing bad air** | People and school students in wards at Moderate or worse at that hour, the worst wards, and the worst moment of the period |
| **City map** | All 24 wards coloured hour by hour; forecast and estimated stations; click a ward to select it |
| **For BMC: tonight's priority wards** | Wards ranked by people × hours × µg/m³ above Moderate (20:00–06:00), with peak and schools; CSV download for BMC's 76 ward squads |
| **Plan my day** | Walk, run, kids playing, commute, elderly / heart-lung, outdoor work: the cleanest hour, the hour to avoid, plain advice |
| **My exposure, and how to cut it** | Home ward, work ward, commute times, exercise and children's outdoor time → PM2.5 breathed in outdoors (µg, US EPA breathing rates) and a cleaner plan, e.g. 250 → 200 µg (−20%) |
| **Share with family** | A picture of your area's air in your language, for WhatsApp |
| **How accurate is this?** | How the model was built and tested, linking to the full evidence dashboard (`/evidence`) |

**Installable app:** on a phone, open the link and choose *Add to Home screen*. It installs as **AirPulse** with its own icon, opens full-screen, and keeps working offline from the last forecast (web app manifest + service worker).

Links can preselect language, ward and hour: `?lang=mr&ward=ME&hour=1`.

## Google tools used, and how

| Google tool | What we use it for | Where in this repo |
|---|---|---|
| **Firebase Hosting** | Serves the live app at `airpulse-mumbai-2026.web.app` over HTTPS on Google's global CDN; data files are cached for 5 minutes so a forecast refresh shows up quickly | `firebase.json`, `.firebaserc`; deployed with `firebase deploy --only hosting` |
| **Google Cloud** | The Firebase project `airpulse-mumbai-2026` is a Google Cloud project; it is the home for the hosting and the next backend services | Firebase console → project `airpulse-mumbai-2026` |
| **Google Fonts** | *DM Sans* for Latin text and *Noto Sans Devanagari* (Google's Noto family) so Hindi and Marathi render cleanly on every phone | `<link>` in `index.html` |
| **Google text-to-speech voices** (Chrome and Android, through the Web Speech API) | The 🔊 **Listen** button reads the forecast, the advice and the personal plan aloud in English, Hindi or Marathi; on Android and Chrome these are Google's voices. Marathi falls back to Hindi when no Marathi voice is installed | `speak()` in `app.js` |

The forecast itself comes from our competition model (LightGBM with NOAA GFS weather). The extra city data comes from the ClimateVerse catalogue: BMC wards and population, and UDISE+ schools.

### Deploy it yourself

```bash
npm install -g firebase-tools        # or: npx firebase-tools ...
firebase login
firebase deploy --only hosting --project airpulse-mumbai-2026
```

## Two forecast engines

| Days | Engine | Inputs | Tested |
|---|---|---|---|
| **11–12 Nov 2026** | Our **competition model** (LightGBM blend, the exact files submitted to Zindi) | Zindi Train to 10 Nov 09:00 + NOAA GFS as issued | 28 backtest windows; past Diwalis |
| **Every later day** | The **daily weather engine** (`scripts/wx_engine.py`): LightGBM that predicts PM2.5 from the GFS forecast, hour, day of year and station; it needs no fresh PM readings, so it keeps working after the last Zindi release | NOAA GFS runs (00Z, 12Z), trained on 278,000 station-hours of Zindi Train | Out-of-time, 1 Sep – 5 Nov 2026, 1–3 days ahead: hourly RMSE **14.4** vs 18.8 for the usual level of that month and hour (−23%); daily correlation **0.75** |

**Daily update** (`scripts/daily_update.sh`): download the newest GFS runs → engine forecast → 24 wards → run the 44 browser tests → deploy to Firebase → push here. Nothing is deployed if a test fails. Each day's tab says which engine made it.

## How it works

1. **Four-station forecast.** Our competition model (LightGBM, trained with NOAA GFS weather as it was issued) forecasts the four official stations for 11–12 Nov 2026, exactly as submitted to the competition.
2. **From 4 stations to 26.** A second model learned from 2024 data how 22 other Mumbai stations move with those four (ridge regression on the four stations plus time of day), blended 50/50 with a distance-weighted average. Tested two ways:
   - hold-out (16 Nov – 31 Dec 2024, 21 stations): RMSE 24.3 µg/m³ vs 29.0 for the distance average alone;
   - two years later (1–16 Oct 2026, 11 stations): 16.3 vs 16.9.
3. **Wards.** Each ward takes the distance-weighted average of all 26 stations at its centre.
4. **People.** Ward population from BMC prabhag data; school enrolment from UDISE+ 2024-25.

## Tests

`tests/run.html` opens the app and clicks through every control in English, Hindi and Marathi. It checks 42 things: the KPIs, the chart, all 24 ward shapes on the map, the exposure counts, the BMC ranking, all six activities, the exposure planner, the share picture, the language switch, the white theme, no emoji, and no script errors.

```bash
python3 -m http.server 8766          # from the repo root
# open http://localhost:8766/tests/run.html   ->   RESULT: 42 passed, 0 failed
```

## Data (all from the challenge package or the ClimateVerse catalogue)

- Zindi challenge package: Train.csv, AdditionalHistory (XKDR 2024 Mumbai stations, other Mumbai stations Oct 2026)
- NOAA GFS forecasts (ClimateVerse)
- BMC administrative ward boundaries (ClimateVerse doi:10.71646/2DGEEJ)
- BMC prabhag boundaries with population (doi:10.71646/EREDWQ)
- UDISE+ 2024-25 school data (doi:10.71646/XJIY8W)

## Run locally

Static site, no build step:

```
python3 -m http.server 8766
# open http://localhost:8766
```

`scripts/build_city.py` and `scripts/build_data.py` produced `data/` and `evidence/data/` inside the competition codebase, which is kept separately.

## Honest limits

- The 22 extra stations are estimated from the four forecast stations; they are not forecast directly. Their data ends on 16 Oct 2026.
- Ward values are interpolated between stations, so local hotspots can be missed.
- Category labels use India's CPCB scale, which is defined for 24-hour averages; hourly colours are a guide.
- Hindi and Marathi text should be reviewed by a native speaker.
- Forecasts are estimates, not medical advice.
