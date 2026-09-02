# DJI Flight Analyzer v3.0

**Local-first, privacy-respecting, free alternative to Airdata UAV for solo/hobbyist pilots.**

## Why Local-First?

Unlike cloud-based tools like Airdata, DJI Flight Analyzer runs entirely on your machine:

- **No uploads** — Your flight logs never leave your computer unless you explicitly export them
- **No account needed** — No sign-up, no email, no subscription
- **No data collection** — Zero telemetry, analytics, or tracking
- **Works offline** — Analyze flights in the field without internet
- **Your data, your rules** — Full control over your flight history

## ✅ Currently Implemented

### Web App (`webapp/`) — React + Vite + Tailwind, backed by the local API
- **Drag & drop .txt flight log upload** — multiple files, uploaded straight to the local backend for decoding and persistence
- **Flight list** — search/filter by filename, aircraft, or tag; tag editor per flight
- **Interactive 2D map** — Leaflet with flight path, takeoff/landing markers, OpenStreetMap/Esri satellite/OpenTopoMap layers, plus opt-in Google roadmap/satellite/hybrid tile layers (hobbyist-use only — see note in `MapView.tsx`)
- **3D flight path view** — Three.js scene rendering the GPS track with altitude on the vertical axis, with an opt-in toggle to replace the flat reference grid with real terrain elevation (queries the public open-elevation.com API with this flight's approximate coordinates — off by default, and the only feature in this app that sends anything beyond map tile requests off-device)
- **Points of interest overlay** — home point, photo/video capture locations, and return-to-home trigger point, plotted on both the 2D and 3D views (DJI Fly manual-flight logs contain no pre-planned mission waypoints, so these are derived from what the log actually records)
- **Animated replay** — play/pause/step/speed controls that drive the map and stat readout forward through the recorded telemetry (there is no control-input data in the log, so this is a replay, not a physics simulation)
- **Charts** — Recharts panels for altitude, speed, vertical speed, battery, voltage, GPS sats, RC signal, temperature, gimbal attitude
- **Flight Insights** — rule-based, fully local analysis of the flight's own telemetry (GPS dropouts, weak RC signal, low landing battery, abrupt altitude changes, temperature extremes) with plain-English suggestions
- **Wind estimation** — an approximate wind speed/direction derived from GPS drift during autopilot hover/attitude-hold segments; clearly labeled as indicative, not a calibrated measurement
- **Firmware version detection** — flight controller/gimbal/camera/RC/battery firmware versions, when present in the log
- **Battery view** — discharge curve, discharge rate, estimated flight time, single-flight health indicator
- **Battery fleet tracking** — per-battery discharge-rate trend across flights, degradation status, capacity/notes editor
- **Battery degradation forecast** — a linear projection of discharge-rate trend (with fit-quality R²) estimating flights remaining until "Degrading"/"Replace Soon" status, requires 4+ flights with telemetry on that battery
- **Aircraft fleet tracking** — flight hours vs. service interval with due/overdue status, nickname/notes editor, maintenance log
- **Flight comparison** — select 2-4 flights and overlay altitude/speed/battery normalized by % of flight duration
- **Export** — JSON, CSV, KML, GeoJSON (requires full telemetry)

### Local Backend (`local-app/`) — FastAPI + pydjirecord
- **Full telemetry decoding** — parses the binary DJI Fly log via `pydjirecord`'s `DJILog`; v12 logs decode with no key, v13+ logs require a DJI API key (`fetch_keychains`) to decrypt
- **Batch upload** — process multiple logs at once
- **Flight phase detection** — takeoff, ascent, cruise, descent, landing
- **Statistics** — computed metrics per flight
- **Fleet & maintenance** — aircraft/battery records auto-linked from log serial numbers, maintenance log entries, service-interval tracking
- **Flight comparison endpoint** — normalized time-series for 2-4 flights
- **Points of interest extraction** — home point, photo/video capture markers, RTH trigger, from the decoded frame stream
- **Firmware version extraction** — from the log's Firmware records (record type 15), keyed by component (MC/GIMBAL/CAMERA/RC/BATTERY)
- **Search, tagging, delete** — filter flights by date/aircraft/battery/tag/free text
- **Export endpoints** — CSV, KML, GeoJSON
- **Runs locally** — your data never hits the internet, except the DJI keychain API call for v13+ decryption and (optionally) map tile requests and the opt-in terrain elevation lookup

## 📁 Project Structure

```
dji-flight-analyzer-v2/
├── webapp/                 # React frontend (GitHub Pages ready)
│   ├── src/
│   │   ├── components/     # FlightUploader, FlightList, FlightDetail, MapView, ChartsPanel, BatteryView, ExportPanel, StatsPanel
│   │   ├── lib/djiParser.ts    # Client-side header parser + format detection
│   │   ├── App.tsx         # Main app with flight list/detail views
│   │   ├── main.tsx        # Entry point
│   │   └── index.css       # Tailwind styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
├── local-app/              # FastAPI backend (optional)
│   ├── app.py              # Full telemetry decryption API
│   ├── requirements.txt
│   └── .env.example
├── LICENSE                 # MIT
└── README.md
```

## 🚀 Quick Start

### Web App (Recommended - No Backend Needed)
```bash
cd webapp
npm install
npm run dev      # http://localhost:5173
npm run build    # produces dist/ — see Deployment below before hosting it separately
```

**Features without API key:** Format detection, header data, file management, empty chart/map placeholders  
**Features with API key + local backend:** Full GPS track, 8 charts, battery discharge curve, exports

### Local Backend (For Full Telemetry)
```bash
cd local-app
cp .env.example .env
# Edit .env and add your DJI_API_KEY from developer.dji.com
pip install -r requirements.txt
python app.py    # http://localhost:8000 (API docs at /docs)
```

The API key lives server-side in `local-app/.env` (`DJI_API_KEY`) — it is used only by the backend's `fetch_keychains` call to DJI for v13+ decryption and is never entered in or sent from the web app.

## 🌐 Deployment

This app is local-first by design: the web app always calls its backend at a relative `/api/...` path, and both are meant to run together on your own machine (`npm run dev` on :5173 with a proxy to :8000, exactly as in Quick Start above).

`webapp/` builds to a portable static bundle (`npm run build` → `webapp/dist/`, already configured with `base: './'`), so it can technically be hosted on GitHub Pages or imported into Vercel as a static site. Doing so today only serves the UI shell, though — a frontend hosted on GitHub Pages/Vercel has no backend at that same origin, so every `/api/...` call will fail and the app will show empty flights/batteries/aircraft lists rather than something useful. There is currently no build-time or runtime setting to point the deployed frontend at a different backend URL (see Roadmap) — that is a deliberate architecture decision for now, not an oversight, so treat GitHub Pages/Vercel hosting as a UI-only preview rather than a working deployment until that is added.

For real use, run both `webapp` and `local-app` together on your own machine as described in Quick Start.

## 🔑 DJI API Key

- **Free** at [developer.dji.com](https://developer.dji.com)
- **Required for:** v13/v14 log decryption (Mini 5 Pro, Air 3, Mavic 3, Mini 4 Pro, etc.)
- **Not required for:** Format detection, header-only parsing
- **Stored locally** — Never sent to any server, only used for local decryption

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet (2D), Three.js (3D flight path) |
| Backend | FastAPI, Python 3.10+ |
| Decryption | pydjirecord (DJI official format) |
| Deploy | GitHub Pages (webapp), Local (backend) |

## 📊 Supported Drones

| Drone | Log Format | Full Telemetry |
|-------|------------|----------------|
| Mini 5 Pro / Mini 4 Pro | v14 | ✅ With API key |
| Air 3 / Air 3S | v14 | ✅ With API key |
| Mavic 3 / 3 Pro / 3 Classic | v14 | ✅ With API key |
| Mini 3 Pro | v13 | ✅ With API key |
| Mini 2 / Mavic Air 2 | v12 | Partial (plaintext) |
| Other DJI Fly app drones | v12-v14 | Varies |

## 🗺 Roadmap

- [ ] SQLite persistence for flight history (currently one JSON file per flight/battery/aircraft)
- [x] POI overlay on map (home point, photo/video captures, RTH trigger — see note above; true mission waypoints aren't in these logs)
- [x] Wind estimation from GPS drift during hover segments (approximate — see note above)
- [x] Firmware version detection
- [x] Real terrain elevation in the 3D view (opt-in, via a public elevation API)
- [ ] Mobile-responsive touch controls
- [ ] Dark mode
- [ ] PWA support for offline use
- [ ] Configurable backend URL so a GitHub Pages/Vercel-hosted frontend can reach a locally-running backend over CORS (deliberately not done yet — see Deployment)

## 📜 License

MIT License — Free for personal and commercial use. See [LICENSE](LICENSE).

## 🤝 Contributing

Issues and PRs welcome! This is a hobbyist project — keep it local-first, privacy-respecting, and free.

---

*"Your flights. Your data. Your machine."*