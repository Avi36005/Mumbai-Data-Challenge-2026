# Mumbai AirPulse

**An honest PM2.5 forecast for four Mumbai stations: the outlook for 11–12 November 2026, plus how far to trust it.**

Built by team **Kryptonite** for the [Google Mumbai Data Challenge: Air Quality Mapping & Forecasting](https://zindi.africa) (Zindi, 2026), creative-submission category.

Most air-quality apps show one number. AirPulse shows the forecast together with the evidence a reader needs to judge it: what the model could actually see, how often it has been right, what past Diwalis did, what the weather says, and where the sensors themselves are weak.

## What is on the page

| Section | What it shows |
|---|---|
| Summary | Worst hour, cleanest hour, most polluted station and rain outlook for the next two days, in plain language |
| 01 Outlook | Hourly PM2.5 for 11–12 Nov per station, exactly as submitted to the competition: the expected forecast and a "smoky nights" version; best 3-hour window to be outdoors each day; an hour-by-hour ribbon on India's CPCB scale |
| 02 What the model knows | The newest readings were fireworks nights. Festival readings are kept but capped at 1.25× each station's normal level; the page shows how many hours were capped and which readings were not used |
| 03 How good, really | 28 historical windows re-run as if it were the day before, against an honest baseline (recent level + daily cycle); past-Diwali re-tests of the submitted pair, including the case that went against it; a blind test on 5–6 Nov |
| 04 Diwali lens | Daily PM2.5 around Lakshmi Puja in 2019, 2024, 2025 and 2026, and the hour-by-hour "night after" curve: smoke outlasts the fireworks |
| 05 Weather | NOAA GFS ventilation (wind × mixing height), wind and rain, with the forecast days shaded |
| 06 Data health | Monthly coverage per station, outages, stuck sensors and impossible values |
| 07 Method | The model, why there are two forecasts, and the ideas that failed blind tests |

## Data

- Zindi challenge package: `Train.csv` (hourly PM2.5, 4 stations, to 10 Nov 2026 09:00 IST), `AdditionalHistory` (Mumbai stations 2018–2020 and 2024).
- NOAA GFS 1° forecasts via the NOAA Open Data Dissemination programme, as listed in the ClimateVerse catalogue.
- No other air-quality feeds. Every forecast uses only data that existed before the forecast was made.

## Run locally

It is a static site (HTML, CSS, JavaScript with D3 and Leaflet; no build step).

```
python3 -m http.server 8765
# open http://localhost:8765        add ?theme=dark for the dark theme
```

`data/*.json` is exported by `scripts/build_data.py` from the competition project (model outputs, backtests, the official data package and the GFS tables). That script runs inside the competition codebase, which is kept separately; this repository holds the finished dashboard.

## Deploy

`firebase.json` is included for Firebase Hosting (`firebase deploy --only hosting`). The site also works on any static host, including GitHub Pages.

## Honest limits

- The post-Diwali level is the biggest unknown; past Diwalis behaved very differently (one year cleaner than before, two years dirtier).
- The "smoky nights" curve comes from two dry years at other Mumbai stations. It is deliberately cautious.
- Forecasts are for four stations, not the whole city.
