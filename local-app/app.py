from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
import json
import csv
import io
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

try:
    from pydjirecord import DJIRecord
    PYDJIRECORD_AVAILABLE = True
except ImportError:
    PYDJIRECORD_AVAILABLE = False
    DJIRecord = None

app = FastAPI(
    title="DJI Flight Analyzer API",
    description="Local backend for full DJI telemetry decryption using pydjirecord",
    version="3.0.0",
    docs_url="/docs",
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DJI API key from environment
DJI_API_KEY = os.getenv("DJI_API_KEY", "")

# In-memory storage (could be SQLite for persistence)
flights_db: dict = {}
flight_counter = 0


class FlightHeader(BaseModel):
    id: str
    filename: str
    aircraft: str
    format: str
    flight_duration: int
    max_altitude: float
    max_distance: float
    max_speed: float
    battery_start: int
    battery_end: int
    has_full_telemetry: bool
    gps_point_count: int


class FlightTelemetry(BaseModel):
    timestamp: int
    latitude: float
    longitude: float
    altitude: float
    horizontal_speed: float
    vertical_speed: float
    battery_percent: int
    cell_voltage: float
    gps_sats: int
    gimbal_pitch: float
    gimbal_roll: float
    gimbal_yaw: float
    rc_signal: int
    temperature: float
    phase: str


class FlightDetail(BaseModel):
    id: str
    header: FlightHeader
    telemetry: list[FlightTelemetry]
    statistics: dict


@app.get("/")
async def root():
    return {
        "name": "DJI Flight Analyzer API",
        "version": "3.0.0",
        "pydjirecord_available": PYDJIRECORD_AVAILABLE,
        "api_key_configured": bool(DJI_API_KEY),
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "pydjirecord": PYDJIRECORD_AVAILABLE,
        "api_key": bool(DJI_API_KEY),
    }


@app.post("/api/upload", response_model=FlightHeader)
async def upload_flight(file: UploadFile = File(...)):
    """Upload and parse a DJI flight log file."""
    global flight_counter

    if not file.filename or not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt flight log files are supported")

    content = await file.read()
    text_content = content.decode("utf-8", errors="replace")

    if not PYDJIRECORD_AVAILABLE:
        # Fallback: header-only parsing
        flight_counter += 1
        flight_id = f"flight_{flight_counter}"
        
        header = FlightHeader(
            id=flight_id,
            filename=file.filename,
            aircraft="Unknown (pydjirecord not installed)",
            format="unknown",
            flight_duration=0,
            max_altitude=0,
            max_distance=0,
            max_speed=0,
            battery_start=0,
            battery_end=0,
            has_full_telemetry=False,
            gps_point_count=0,
        )
        
        flights_db[flight_id] = {
            "header": header,
            "telemetry": [],
            "raw": text_content,
        }
        
        return header

    try:
        # Parse with pydjirecord using API key
        record = DJIRecord(text_content, DJI_API_KEY)
        
        flight_counter += 1
        flight_id = f"flight_{flight_counter}"
        
        # Extract telemetry points
        telemetry_points = []
        for p in record.gps_points:
            telemetry_points.append(FlightTelemetry(
                timestamp=p.timestamp,
                latitude=p.latitude,
                longitude=p.longitude,
                altitude=p.altitude,
                horizontal_speed=p.horizontal_speed,
                vertical_speed=p.vertical_speed,
                battery_percent=p.battery_percent,
                cell_voltage=p.cell_voltage,
                gps_sats=p.gps_sats,
                gimbal_pitch=p.gimbal_pitch,
                gimbal_roll=p.gimbal_roll,
                gimbal_yaw=p.gimbal_yaw,
                rc_signal=p.rc_signal,
                temperature=p.temperature,
                phase=detect_flight_phase(p),
            ))
        
        header = FlightHeader(
            id=flight_id,
            filename=file.filename,
            aircraft=record.aircraft_type,
            format="v14" if record.is_encrypted else "v13",
            flight_duration=record.flight_duration,
            max_altitude=record.max_altitude,
            max_distance=record.max_distance,
            max_speed=record.max_speed,
            battery_start=record.battery_start_percent,
            battery_end=record.battery_end_percent,
            has_full_telemetry=True,
            gps_point_count=len(record.gps_points),
        )
        
        flights_db[flight_id] = {
            "header": header,
            "telemetry": telemetry_points,
            "record": record,
        }
        
        return header

    except Exception as e:
        # Fallback for unparseable logs
        flight_counter += 1
        flight_id = f"flight_{flight_counter}"
        
        header = FlightHeader(
            id=flight_id,
            filename=file.filename,
            aircraft="Parse failed",
            format="unknown",
            flight_duration=0,
            max_altitude=0,
            max_distance=0,
            max_speed=0,
            battery_start=0,
            battery_end=0,
            has_full_telemetry=False,
            gps_point_count=0,
        )
        
        flights_db[flight_id] = {
            "header": header,
            "telemetry": [],
            "raw": text_content,
            "error": str(e),
        }
        
        return header


def detect_flight_phase(point) -> str:
    """Simple flight phase detection."""
    alt = getattr(point, 'altitude', 0)
    v_speed = getattr(point, 'vertical_speed', 0)
    h_speed = getattr(point, 'horizontal_speed', 0)
    
    if alt < 3 and h_speed < 1 and v_speed <= 0:
        return "landing"
    if alt < 10 and v_speed > 1:
        return "takeoff"
    if v_speed > 0.5:
        return "ascent"
    if v_speed < -0.5:
        return "descent"
    if h_speed > 2:
        return "cruise"
    return "cruise"


@app.get("/api/flights", response_model=list[FlightHeader])
async def list_flights():
    """List all uploaded flights."""
    return [
        {
            "id": fid,
            "filename": fdata["header"].filename,
            "aircraft": fdata["header"].aircraft,
            "format": fdata["header"].format,
            "flight_duration": fdata["header"].flight_duration,
            "max_altitude": fdata["header"].max_altitude,
            "max_distance": fdata["header"].max_distance,
            "max_speed": fdata["header"].max_speed,
            "battery_start": fdata["header"].battery_start,
            "battery_end": fdata["header"].battery_end,
            "has_full_telemetry": fdata["header"].has_full_telemetry,
            "gps_point_count": fdata["header"].gps_point_count,
        }
        for fid, fdata in flights_db.items()
    ]


@app.get("/api/flights/{flight_id}", response_model=FlightDetail)
async def get_flight(flight_id: str):
    """Get detailed flight data including telemetry."""
    if flight_id not in flights_db:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    fdata = flights_db[flight_id]
    header = fdata["header"]
    telemetry = fdata.get("telemetry", [])
    
    # Calculate statistics
    stats = calculate_statistics(telemetry)
    
    return {
        "id": flight_id,
        "header": header,
        "telemetry": telemetry,
        "statistics": stats,
    }


def calculate_statistics(telemetry: list) -> dict:
    if not telemetry:
        return {}
    
    altitudes = [p.altitude for p in telemetry]
    speeds = [p.horizontal_speed for p in telemetry]
    v_speeds = [p.vertical_speed for p in telemetry]
    batteries = [p.battery_percent for p in telemetry]
    voltages = [p.cell_voltage for p in telemetry]
    gps_sats = [p.gps_sats for p in telemetry]
    rc_signals = [p.rc_signal for p in telemetry]
    temps = [p.temperature for p in telemetry]
    
    # Flight phase duration
    phase_counts = {}
    for p in telemetry:
        phase_counts[p.phase] = phase_counts.get(p.phase, 0) + 1
    
    battery_drop = batteries[0] - batteries[-1] if batteries else 0
    time_span_min = (telemetry[-1].timestamp - telemetry[0].timestamp) / 60000 if len(telemetry) > 1 else 1
    discharge_rate = battery_drop / time_span_min if time_span_min > 0 else 0
    
    return {
        "max_altitude": max(altitudes),
        "min_altitude": min(altitudes),
        "total_distance_km": sum(
            haversine(telemetry[i-1].latitude, telemetry[i-1].longitude,
                     telemetry[i].latitude, telemetry[i].longitude)
            for i in range(1, len(telemetry))
        ) / 1000,
        "max_speed": max(speeds),
        "avg_speed": sum(speeds) / len(speeds),
        "max_vertical_speed": max(v_speeds),
        "min_vertical_speed": min(v_speeds),
        "battery_consumed": battery_drop,
        "discharge_rate_pct_min": round(discharge_rate, 2),
        "estimated_flight_time_min": round(batteries[-1] / discharge_rate, 0) if discharge_rate > 0 else 0,
        "max_gps_sats": max(gps_sats),
        "min_gps_sats": min(gps_sats),
        "max_rc_signal": max(rc_signals),
        "min_rc_signal": min(rc_signals),
        "max_temp": max(temps),
        "min_temp": min(temps),
        "flight_phases": phase_counts,
    }


def haversine(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, sqrt, atan2
    R = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return 2 * R * atan2(sqrt(a), sqrt(1-a))


# Export endpoints
@app.get("/api/export/csv/{flight_id}")
async def export_csv(flight_id: str):
    if flight_id not in flights_db:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    fdata = flights_db[flight_id]
    telemetry = fdata.get("telemetry", [])
    
    if not telemetry:
        raise HTTPException(status_code=400, detail="No telemetry data")
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "timestamp", "latitude", "longitude", "altitude",
        "horizontal_speed", "vertical_speed", "battery_percent",
        "cell_voltage", "gps_sats", "gimbal_pitch", "gimbal_roll", "gimbal_yaw",
        "rc_signal", "temperature", "phase"
    ])
    for p in telemetry:
        writer.writerow([
            p.timestamp, p.latitude, p.longitude, p.altitude,
            p.horizontal_speed, p.vertical_speed, p.battery_percent,
            p.cell_voltage, p.gps_sats, p.gimbal_pitch, p.gimbal_roll, p.gimbal_yaw,
            p.rc_signal, p.temperature, p.phase
        ])
    
    return JSONResponse(content={
        "filename": f"dji-flight-{flight_id}.csv",
        "content": output.getvalue(),
        "format": "csv",
        "point_count": len(telemetry),
    })


@app.get("/api/export/kml/{flight_id}")
async def export_kml(flight_id: str):
    if flight_id not in flights_db:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    fdata = flights_db[flight_id]
    telemetry = fdata.get("telemetry", [])
    
    if not telemetry:
        raise HTTPException(status_code=400, detail="No telemetry data")
    
    coords = " ".join(f"{p.longitude},{p.latitude},{p.altitude}" for p in telemetry)
    
    kml = f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>DJI Flight - {flight_id}</name>
  <Style id="flightStyle"><LineStyle><color>ff0000ff</color><width>4</width></LineStyle></Style>
  <Placemark>
    <name>Flight Path</name>
    <styleUrl>#flightStyle</styleUrl>
    <LineString><tessellate>1</tessellate><coordinates>{coords}</coordinates></LineString>
  </Placemark>
</Document>
</kml>'''
    
    return JSONResponse(content={
        "filename": f"dji-flight-{flight_id}.kml",
        "content": kml,
        "format": "kml",
        "point_count": len(telemetry),
    })


@app.get("/api/export/geojson/{flight_id}")
async def export_geojson(flight_id: str):
    if flight_id not in flights_db:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    fdata = flights_db[flight_id]
    telemetry = fdata.get("telemetry", [])
    header = fdata["header"]
    
    if not telemetry:
        raise HTTPException(status_code=400, detail="No telemetry data")
    
    geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[p.longitude, p.latitude, p.altitude] for p in telemetry],
            },
            "properties": {
                "aircraft": header.aircraft,
                "max_altitude": header.max_altitude,
                "max_speed": header.max_speed,
                "flight_duration": header.flight_duration,
                "battery_start": header.battery_start,
                "battery_end": header.battery_end,
                "gps_point_count": len(telemetry),
            },
        }],
    }
    
    return JSONResponse(content={
        "filename": f"dji-flight-{flight_id}.geojson",
        "content": geojson,
        "format": "geojson",
        "point_count": len(telemetry),
    })


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)