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

### Web App (`webapp/`) — Client-side React + Vite + Tailwind
- **Drag & drop .txt flight log upload** — Multiple files supported
- **Format detection** — Identifies DJI Fly v12, v13, v14 logs
- **Header parsing** — Aircraft, serial, duration, location, max altitude/distance/speed, battery %, captures
- **Interactive map** — Leaflet with flight path, takeoff/landing markers, playback scrubber
- **Charts** — Recharts panels for altitude, speed, vertical speed, battery, voltage, GPS sats, RC signal, temperature, gimbal attitude
- **Battery view** — Discharge curve, discharge rate, estimated flight time, health indicator
- **Export** — JSON, CSV, KML, GeoJSON (requires full telemetry)
- **API key input** — Optional DJI key for full telemetry via local backend

### Local Backend (`local-app/`) — FastAPI + pydjirecord
- **Full telemetry decryption** — Uses DJI API key + pydjirecord for v13/v14 logs
- **Batch upload** — Process multiple logs at once
- **Complete telemetry** — 1Hz GPS points with all sensor data
- **Flight phase detection** — Takeoff, ascent, cruise, descent, landing
- **Statistics** — 30+ computed metrics per flight
- **Export endpoints** — CSV, KML, GeoJSON
- **Runs locally** — Your data never hits the internet

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
npm run build    # Deploy dist/ to GitHub Pages
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

Then in the web app, enter your DJI API key — it will call the local backend for full decryption.

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
| Maps | Leaflet + react-leaflet |
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

- [ ] SQLite persistence for flight history
- [ ] Multi-flight battery degradation trends
- [ ] Waypoint/POI overlay on map
- [ ] Wind estimation from drift
- [ ] Firmware version detection
- [ ] Mobile-responsive touch controls
- [ ] Dark mode
- [ ] PWA support for offline use

## 📜 License

MIT License — Free for personal and commercial use. See [LICENSE](LICENSE).

## 🤝 Contributing

Issues and PRs welcome! This is a hobbyist project — keep it local-first, privacy-respecting, and free.

---

*"Your flights. Your data. Your machine."*