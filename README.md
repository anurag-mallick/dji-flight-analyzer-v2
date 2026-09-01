# DJI Flight Analyzer v3.0

Professional DJI flight log analysis platform with Web + Local versions.

## 🚀 Features

### Web Version (GitHub Pages)
- **100% client-side** - No server needed, all processing in browser
- **Upload .txt flight logs** from DJI Fly app
- **Full telemetry data** extraction (no API key needed for header data)
- **Interactive map** with flight path visualization on OpenStreetMap
- **8 chart types** showing telemetry over time:
  - Altitude, Speed, Battery, Voltage
  - Attitude (Pitch, Roll, Yaw), GPS Satellites
  - RC Signal strength, Temperature
- **30+ flight statistics:** max altitude, distance, speed, battery usage, etc.
- **Export data** to JSON, CSV, KML, GeoJSON
- **Responsive design** - Works on mobile & desktop

### Local Desktop App
- **Full GPS track** with 1968+ data points
- **Battery health analysis** (cycle monitoring, voltage/temp trends)
- **All 8 chart types** with real data
- **RC signal analysis** (uplink/downlink percentages)
- **Batch upload** multiple flights at once
- **Advanced export:** JSON, CSV, KML, GeoJSON
- **API key management** (DJI API key integrates seamlessly)

### DJI API Key (Optional but Recommended)
- **Works for all v13/v14 logs** - Your key: `YOUR_DJI_API_KEY`
- **Provides:** Full frame-level telemetry data
- **Free to obtain:** [developer.dji.com](https://developer.dji.com)
- **One-time setup** - Key is saved locally and works for all flights

### Supported Drones
- DJI Mini 5 Pro / Mini 4 Pro
- DJI Air 3 / Air 3S
- DJI Mavic 3 series
- DJI Mini 3 Pro / Mini 2
- And other DJI drones using DJI Fly app

## 📦 Quick Start

### Web Version
```bash
# Deploy to GitHub Pages
cd webapp
npm install && npm run build
# Deploy dist/ folder to GitHub Pages settings

# Or visit: https://anurag-mallick.github.io/dji-flight-analyzer-v2
```

### Local Desktop App
```bash
# Install Python dependencies
cd local-app
pip install -r requirements.txt

# Start the app
python app.py

# Open: http://localhost:5173
```

## 📊 What the App Analyzes

### Header Data (Always Available)
- Aircraft model & serial numbers
- App version & platform (iOS/Android)
- Flight start time & duration
- Takeoff GPS coordinates
- Max altitude, distance, speed
- Battery info, capture count, video time

### Full Telemetry (With API Key)
- **Every GPS point** along the flight path
- **Battery percentage** over entire flight
- **Speed profiles** (horizontal, vertical, total)
- **Gimbal orientation** (pitch, roll, yaw)
- **RC signal strength** (uplink/downlink %)
- **Temperature monitoring** over time
- **Cell voltage** details (per-cell data)
- **Flight phase detection** (takeoff, cruise, ascent, descent)

## 📁 File Structure

```
dji-flight-analyzer-v2/
├── webapp/              # Web version (GitHub Pages)
│   ├── src/             # React + Tailwind source
│   ├── vite.config.js   # Vite config
│   └── tailwind.config.js
│
├── local-app/           # Local desktop app
│   ├── app.py           # FastAPI backend
│   ├── requirements.txt # Python deps
│   └── frontend/        # React frontend
│
└── README.md            # This file
```

## 🛠️ Tech Stack

### Web Version
- **Frontend:** React 18, Tailwind CSS v3, Recharts, Leaflet
- **Parser:** Custom JavaScript DJI log parser (header-only)
- **Build:** Vite

### Local Version
- **Backend:** FastAPI + Python pydjirecord
- **Frontend:** React + Tailwind + Recharts + Leaflet
- **Parser:** Python-based DJI log decryption
- **API:** DJI Developer API key for v13/v14 encryption

## 📸 Screenshots

### Web Version Dashboard
- Flight statistics cards with gradient design
- Interactive map with path visualization
- Tabbed telemetry charts
- Export buttons for all formats

### Local App Features
- Full GPS track on map
- 8 different chart types toggleable
- Detailed flight stats panel
- Batch upload interface
- API key management panel

## 📜 License

MIT License - Free for personal and commercial use.

## 📧 Contact

- **GitHub:** [@anurag-mallick](https://github.com/anurag-mallick)
- **Repository:** [dji-flight-analyzer-v2](https://github.com/anurag-mallick/dji-flight-analyzer-v2)

---
*"Turn your DJI flight data into actionable insights."*
