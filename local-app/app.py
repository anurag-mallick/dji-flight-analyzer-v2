from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
import json
import csv
import io
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

try:
    from pydjirecord import DJILog
    from pydjirecord.frame.builder import records_to_frames
    PYDJIRECORD_AVAILABLE = True
except ImportError:
    PYDJIRECORD_AVAILABLE = False
    DJILog = None
    records_to_frames = None

from db import (
    save_flight, get_flight, list_flights, delete_flight,
    get_flight_telemetry,
    get_or_create_battery, get_battery, list_batteries, update_battery,
    get_battery_flights, get_battery_health_stats,
    link_flight_to_battery, link_flight_to_aircraft,
    get_or_create_aircraft, get_aircraft, list_aircraft, update_aircraft,
    add_maintenance_log, get_maintenance_logs,
    update_flight_tags, search_flights, get_flights_for_comparison,
)

app = FastAPI(
    title="DJI Flight Analyzer API",
    description="Local backend for full DJI telemetry decryption using pydjirecord",
    version="3.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DJI_API_KEY = os.getenv("DJI_API_KEY", "")


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
    upload_date: Optional[str] = None
    tags: Optional[str] = None
    battery_id: str = ""
    aircraft_id: str = ""
    firmware: Optional[dict] = None


def _flight_header_from_record(f: dict) -> "FlightHeader":
    """Build a FlightHeader response from a stored flight record dict."""
    return FlightHeader(
        id=f["id"],
        filename=f["filename"],
        aircraft=f["aircraft"] or "Unknown",
        format=f["format"] or "unknown",
        flight_duration=f["flight_duration"],
        max_altitude=f["max_altitude"],
        max_distance=f["max_distance"],
        max_speed=f["max_speed"],
        battery_start=f["battery_start"],
        battery_end=f["battery_end"],
        has_full_telemetry=f["has_full_telemetry"],
        gps_point_count=f["gps_point_count"],
        upload_date=f.get("upload_date"),
        tags=f.get("tags"),
        battery_id=f.get("battery_id") or "",
        aircraft_id=f.get("aircraft_id") or "",
        firmware=f.get("firmware") or None,
    )


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
    flight_mode: str = ""


class PointOfInterest(BaseModel):
    type: str  # "home" | "photo" | "video_start" | "rth"
    label: str
    latitude: float
    longitude: float
    timestamp: Optional[int] = None  # ms since flight start; None for the home point


class FlightDetail(BaseModel):
    id: str
    header: FlightHeader
    telemetry: List[FlightTelemetry]
    statistics: dict
    pois: List[PointOfInterest] = []


class BatteryHealth(BaseModel):
    flight_count: int
    avg_discharge_rate: float
    discharge_rates: List[float]
    avg_voltage_sag: float
    degradation_pct: float
    early_avg_rate: float
    recent_avg_rate: float
    status: str


class AircraftInfo(BaseModel):
    id: str
    nickname: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    total_flight_hours: float
    service_interval_hours: int
    notes: Optional[str]
    flight_count: int


class MaintenanceLog(BaseModel):
    id: int
    aircraft_id: str
    service_date: str
    note: str


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


def _save_unparsed_flight(filename: str, aircraft_label: str) -> "FlightHeader":
    """Persist a header-only flight record when telemetry could not be decoded."""
    flight_id = f"flight_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    header = FlightHeader(
        id=flight_id,
        filename=filename,
        aircraft=aircraft_label,
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
    flight_record = {
        "id": flight_id,
        "filename": filename,
        "aircraft": header.aircraft,
        "format": header.format,
        "upload_date": datetime.now().isoformat(),
        "flight_start_time": None,
        "flight_duration": 0,
        "max_altitude": 0,
        "max_distance": 0,
        "max_speed": 0,
        "battery_start": 0,
        "battery_end": 0,
        "gps_point_count": 0,
        "has_full_telemetry": False,
        "telemetry": [],
        "tags": None,
        "battery_id": "",
        "aircraft_id": "",
    }
    save_flight(flight_record)
    return header


@app.post("/api/upload", response_model=FlightHeader)
async def upload_flight(file: UploadFile = File(...)):
    """Upload and parse a DJI flight log file (binary DJI Fly / Go format)."""
    if not file.filename or not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt flight log files are supported")

    content = await file.read()  # raw binary log bytes — must NOT be decoded as text

    if not PYDJIRECORD_AVAILABLE:
        return _save_unparsed_flight(file.filename, "Unknown (pydjirecord not installed)")

    try:
        log = DJILog.from_bytes(content)
    except Exception:
        return _save_unparsed_flight(file.filename, "Parse failed")

    details = log.details
    aircraft_name = details.aircraft_name or details.product_type.name.replace("_", " ").title()

    # v12 logs need no decryption; v13+ logs need a DJI API key to fetch keychains.
    records = []
    frames = []
    try:
        if log.version < 13:
            records = log.records(None)
        elif DJI_API_KEY:
            keychains = log.fetch_keychains(DJI_API_KEY)
            records = log.records(keychains)
        # else: v13+ log with no API key configured — header-only, as documented in the README
        if records:
            frames = records_to_frames(records, details)
    except Exception:
        records, frames = [], []

    firmware = _extract_firmware(records)
    pois = _extract_pois(frames)

    has_full_telemetry = len(frames) > 0
    telemetry_points = [
        FlightTelemetry(
            timestamp=int(f.osd.fly_time * 1000),
            latitude=f.osd.latitude,
            longitude=f.osd.longitude,
            altitude=f.osd.height,
            horizontal_speed=f.osd.h_speed,
            vertical_speed=f.osd.z_speed,
            battery_percent=f.battery.charge_level,
            cell_voltage=(sum(f.battery.cell_voltages) / len(f.battery.cell_voltages)) if f.battery.cell_voltages else f.battery.voltage,
            gps_sats=f.osd.gps_num,
            gimbal_pitch=f.gimbal.pitch,
            gimbal_roll=f.gimbal.roll,
            gimbal_yaw=f.gimbal.yaw,
            rc_signal=f.rc.downlink_signal or 0,
            temperature=f.battery.temperature,
            phase=detect_flight_phase(f.osd.height, f.osd.z_speed, f.osd.h_speed),
            flight_mode=f.osd.flyc_state.name if f.osd.flyc_state else "",
        )
        for f in frames
    ]

    flight_id = f"flight_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    # The DJI Fly header's total_distance/capture_num can be stale or always-zero
    # (see pydjirecord's Details docstring) — prefer the decrypted frame track when available.
    max_distance = frames[-1].osd.cumulative_distance if frames else details.total_distance
    header = FlightHeader(
        id=flight_id,
        filename=file.filename,
        aircraft=aircraft_name or "Unknown",
        format=f"v{log.version}",
        flight_duration=int(details.total_time),
        max_altitude=details.max_height,
        max_distance=max_distance,
        max_speed=details.max_horizontal_speed,
        battery_start=telemetry_points[0].battery_percent if telemetry_points else 0,
        battery_end=telemetry_points[-1].battery_percent if telemetry_points else 0,
        has_full_telemetry=has_full_telemetry,
        gps_point_count=len(telemetry_points),
        firmware=firmware or None,
    )

    battery_id = get_or_create_battery(details.battery_sn) if details.battery_sn else ""
    aircraft_id = get_or_create_aircraft(details.aircraft_sn, aircraft_name) if details.aircraft_sn else ""

    flight_record = {
        "id": flight_id,
        "filename": file.filename,
        "aircraft": header.aircraft,
        "format": header.format,
        "upload_date": datetime.now().isoformat(),
        "flight_start_time": details.start_time.isoformat() if details.start_time else None,
        "flight_duration": header.flight_duration,
        "max_altitude": header.max_altitude,
        "max_distance": header.max_distance,
        "max_speed": header.max_speed,
        "battery_start": header.battery_start,
        "battery_end": header.battery_end,
        "gps_point_count": header.gps_point_count,
        "has_full_telemetry": header.has_full_telemetry,
        "telemetry": [t.model_dump() for t in telemetry_points],
        "tags": None,
        "battery_id": battery_id,
        "aircraft_id": aircraft_id,
        "firmware": firmware,
        "pois": pois,
    }
    save_flight(flight_record)

    if battery_id:
        link_flight_to_battery(battery_id, flight_id)
    if aircraft_id:
        link_flight_to_aircraft(aircraft_id, flight_id)

    return header


def _extract_firmware(records: list) -> dict:
    """Pull component firmware versions (record_type 15 == Firmware) out of the raw record stream."""
    firmware = {}
    for r in records:
        if r.record_type == 15:  # Firmware, per pydjirecord.record.__init__'s magic-number table
            firmware[r.data.sender_type.name] = r.data.version
    return firmware


def _extract_pois(frames: list) -> list:
    """Derive point-of-interest markers from decoded frames: home point, photo/video
    capture locations, and the point return-to-home was triggered. There is no
    pre-planned mission waypoint data in a DJI Fly manual-flight log to draw on."""
    pois = []

    home = next((f.home for f in frames if f.home.latitude or f.home.longitude), None)
    if home:
        pois.append({"type": "home", "label": "Home Point", "latitude": home.latitude, "longitude": home.longitude, "timestamp": None})

    prev_photo = prev_video = False
    prev_go_home_standby = True
    for f in frames:
        if f.osd.latitude == 0 and f.osd.longitude == 0:
            continue
        ts = int(f.osd.fly_time * 1000)

        if f.camera.is_photo and not prev_photo:
            pois.append({"type": "photo", "label": "Photo Captured", "latitude": f.osd.latitude, "longitude": f.osd.longitude, "timestamp": ts})
        prev_photo = f.camera.is_photo

        if f.camera.is_video and not prev_video:
            pois.append({"type": "video_start", "label": "Video Recording Started", "latitude": f.osd.latitude, "longitude": f.osd.longitude, "timestamp": ts})
        prev_video = f.camera.is_video

        is_standby = f.osd.go_home_status is None or f.osd.go_home_status.name == "STANDBY"
        if not is_standby and prev_go_home_standby:
            pois.append({"type": "rth", "label": "Return-to-Home Triggered", "latitude": f.osd.latitude, "longitude": f.osd.longitude, "timestamp": ts})
        prev_go_home_standby = is_standby

    return pois


def detect_flight_phase(alt: float, v_speed: float, h_speed: float) -> str:
    if alt < 3 and h_speed < 1 and v_speed <= 0:
        return "landing"
    if alt < 10 and v_speed > 1:
        return "takeoff"
    if v_speed > 0.5:
        return "ascent"
    if v_speed < -0.5:
        return "descent"
    return "cruise"


@app.get("/api/flights", response_model=List[FlightHeader])
async def list_flights_endpoint():
    return [_flight_header_from_record(f) for f in list_flights()]


@app.get("/api/flights/search", response_model=List[FlightHeader])
async def search_flights_endpoint(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    aircraft_id: Optional[str] = None,
    battery_id: Optional[str] = None,
    tags: Optional[str] = None,
    free_text: Optional[str] = None,
):
    flights = search_flights(
        date_from=date_from,
        date_to=date_to,
        aircraft_id=aircraft_id,
        battery_id=battery_id,
        tags=tags,
        free_text=free_text,
    )
    return [_flight_header_from_record(f) for f in flights]


@app.delete("/api/flights/{flight_id}")
async def delete_flight_endpoint(flight_id: str):
    if not delete_flight(flight_id):
        raise HTTPException(status_code=404, detail="Flight not found")
    return {"deleted": flight_id}


@app.get("/api/flights/{flight_id}", response_model=FlightDetail)
async def get_flight_endpoint(flight_id: str):
    flight = get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    telemetry = flight.get("telemetry", [])
    stats = calculate_statistics(telemetry)

    return FlightDetail(
        id=flight["id"],
        header=_flight_header_from_record(flight),
        telemetry=[FlightTelemetry(**t) for t in telemetry],
        statistics=stats,
        pois=[PointOfInterest(**p) for p in flight.get("pois", [])],
    )


def calculate_statistics(telemetry: List) -> dict:
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


# ============ EXPORT ENDPOINTS ============

@app.get("/api/export/csv/{flight_id}")
async def export_csv(flight_id: str):
    flight = get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    telemetry = flight.get("telemetry", [])
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
            p["timestamp"], p["latitude"], p["longitude"], p["altitude"],
            p["horizontal_speed"], p["vertical_speed"], p["battery_percent"],
            p["cell_voltage"], p["gps_sats"], p["gimbal_pitch"], p["gimbal_roll"], p["gimbal_yaw"],
            p["rc_signal"], p["temperature"], p["phase"]
        ])
    
    return JSONResponse(content={
        "filename": f"dji-flight-{flight_id}.csv",
        "content": output.getvalue(),
        "format": "csv",
        "point_count": len(telemetry),
    })


@app.get("/api/export/kml/{flight_id}")
async def export_kml(flight_id: str):
    flight = get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    telemetry = flight.get("telemetry", [])
    if not telemetry:
        raise HTTPException(status_code=400, detail="No telemetry data")
    
    coords = " ".join(f"{p['longitude']},{p['latitude']},{p['altitude']}" for p in telemetry)
    
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
    flight = get_flight(flight_id)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    telemetry = flight.get("telemetry", [])
    if not telemetry:
        raise HTTPException(status_code=400, detail="No telemetry data")
    
    geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[p["longitude"], p["latitude"], p["altitude"]] for p in telemetry],
            },
            "properties": {
                "aircraft": flight["aircraft"],
                "max_altitude": flight["max_altitude"],
                "max_speed": flight["max_speed"],
                "flight_duration": flight["flight_duration"],
                "battery_start": flight["battery_start"],
                "battery_end": flight["battery_end"],
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


# ============ BATTERY ENDPOINTS ============

@app.get("/api/batteries")
async def list_batteries_endpoint():
    return list_batteries()


@app.get("/api/batteries/{battery_id}")
async def get_battery_endpoint(battery_id: str):
    battery = get_battery(battery_id)
    if not battery:
        raise HTTPException(status_code=404, detail="Battery not found")
    return battery


@app.get("/api/batteries/{battery_id}/flights")
async def get_battery_flights_endpoint(battery_id: str):
    return [_flight_header_from_record(f) for f in get_battery_flights(battery_id)]


@app.get("/api/batteries/{battery_id}/health")
async def get_battery_health_endpoint(battery_id: str):
    health = get_battery_health_stats(battery_id)
    if health.get("status") == "no_data":
        raise HTTPException(status_code=404, detail="No flight data for this battery")
    return health


@app.patch("/api/batteries/{battery_id}")
async def update_battery_endpoint(battery_id: str, data: dict):
    ok = update_battery(battery_id, **data)
    if not ok:
        raise HTTPException(status_code=404, detail="Battery not found")
    return get_battery(battery_id)


# ============ AIRCRAFT ENDPOINTS ============

@app.get("/api/aircraft")
async def list_aircraft_endpoint():
    return list_aircraft()


@app.get("/api/aircraft/{aircraft_id}")
async def get_aircraft_endpoint(aircraft_id: str):
    aircraft = get_aircraft(aircraft_id)
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    return aircraft


@app.patch("/api/aircraft/{aircraft_id}")
async def update_aircraft_endpoint(aircraft_id: str, data: dict):
    ok = update_aircraft(aircraft_id, **data)
    if not ok:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    return get_aircraft(aircraft_id)


# ============ MAINTENANCE LOG ENDPOINTS ============

@app.post("/api/aircraft/{aircraft_id}/maintenance")
async def add_maintenance_endpoint(aircraft_id: str, note: str, service_date: Optional[str] = None):
    try:
        log_id = add_maintenance_log(aircraft_id, note, service_date)
        logs = get_maintenance_logs(aircraft_id)
        for log in logs:
            if log["id"] == log_id:
                return log
        raise HTTPException(status_code=500, detail="Failed to create log")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/aircraft/{aircraft_id}/maintenance")
async def get_maintenance_endpoint(aircraft_id: str):
    return get_maintenance_logs(aircraft_id)


# ============ FLIGHT TAGS ============

@app.patch("/api/flights/{flight_id}/tags")
async def update_flight_tags_endpoint(flight_id: str, tags: str):
    ok = update_flight_tags(flight_id, tags)
    if not ok:
        raise HTTPException(status_code=404, detail="Flight not found")
    return {"id": flight_id, "tags": tags}


# ============ FLIGHT COMPARISON ============

@app.post("/api/flights/compare")
async def compare_flights(flight_ids: List[str] = Body(..., embed=False)):
    if len(flight_ids) < 2 or len(flight_ids) > 4:
        raise HTTPException(status_code=400, detail="Select 2-4 flights to compare")
    
    flights = get_flights_for_comparison(flight_ids)
    if len(flights) != len(flight_ids):
        raise HTTPException(status_code=404, detail="One or more flights not found")
    
    # Return normalized telemetry for comparison
    result = []
    for f in flights:
        telemetry = f.get("telemetry", [])
        if not telemetry:
            continue
        # Normalize time to 0..1 for overlay
        start_time = telemetry[0]["timestamp"]
        end_time = telemetry[-1]["timestamp"]
        duration = end_time - start_time
        normalized = []
        for p in telemetry:
            norm_time = (p["timestamp"] - start_time) / duration if duration > 0 else 0
            normalized.append({
                "norm_time": norm_time,
                "time": p["timestamp"],
                "altitude": p["altitude"],
                "speed": p["horizontal_speed"],
                "battery": p["battery_percent"],
            })
        result.append({
            "id": f["id"],
            "filename": f["filename"],
            "aircraft": f["aircraft"],
            "duration": duration,
            "telemetry": normalized,
        })
    
    return result


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)