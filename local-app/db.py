import json
import os
import glob
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
import shutil

DATA_DIR = Path(__file__).parent / "data"
FLIGHTS_DIR = DATA_DIR / "flights"
BATTERIES_DIR = DATA_DIR / "batteries"
AIRCRAFT_DIR = DATA_DIR / "aircraft"

# Create directories on import
for d in (DATA_DIR, FLIGHTS_DIR, BATTERIES_DIR, AIRCRAFT_DIR):
    d.mkdir(parents=True, exist_ok=True)


# ============ LOW-LEVEL FILE OPS ============

def _flight_path(flight_id: str) -> Path:
    return FLIGHTS_DIR / f"{flight_id}.json"


def _battery_path(battery_id: str) -> Path:
    return BATTERIES_DIR / f"{battery_id}.json"


def _aircraft_path(aircraft_id: str) -> Path:
    return AIRCRAFT_DIR / f"{aircraft_id}.json"


def _load_json(path: Path) -> Optional[Dict[str, Any]]:
    if path.exists():
        with open(path, 'r') as f:
            return json.load(f)
    return None


def _save_json(path: Path, data: Dict[str, Any]) -> None:
    # Atomic write: write to temp, then rename
    tmp = path.with_suffix('.tmp')
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=2)
    tmp.replace(path)


def _delete_file(path: Path) -> bool:
    if path.exists():
        path.unlink()
        return True
    return False


def _list_ids(dir_path: Path, prefix: str = "") -> List[str]:
    """Get all IDs from JSON files in directory."""
    ids = []
    for f in dir_path.glob("*.json"):
        if not f.name.startswith('.'):
            ids.append(f.stem)
    return sorted(ids, reverse=True)  # newest first by filename


# ============ FLIGHTS ============

def save_flight(flight: Dict[str, Any]) -> str:
    """Save flight to JSON file. Returns flight ID."""
    flight_id = flight["id"]
    _save_json(_flight_path(flight_id), flight)
    return flight_id


def get_flight(flight_id: str) -> Optional[Dict[str, Any]]:
    return _load_json(_flight_path(flight_id))


def list_flights() -> List[Dict[str, Any]]:
    """List all flights, most recent first (by upload_date)."""
    flights = []
    for fid in _list_ids(FLIGHTS_DIR):
        flight = get_flight(fid)
        if flight:
            # Return summary without full telemetry for list view
            summary = {k: v for k, v in flight.items() if k != 'telemetry'}
            summary['telemetry'] = []  # empty for list
            flights.append(summary)
    return flights


def delete_flight(flight_id: str) -> bool:
    return _delete_file(_flight_path(flight_id))


def get_flight_telemetry(flight_id: str) -> List[Dict[str, Any]]:
    """Get just the telemetry array for a flight."""
    flight = get_flight(flight_id)
    return flight.get("telemetry", []) if flight else []


# ============ BATTERIES ============

def _generate_battery_id(serial_number: Optional[str]) -> str:
    if serial_number:
        return f"bat_{serial_number}"
    return f"bat_unknown_{datetime.now().strftime('%Y%m%d_%H%M%S')}"


def get_or_create_battery(serial_number: Optional[str] = None) -> str:
    if not serial_number:
        return ""
    
    battery_id = f"bat_{serial_number}"
    path = _battery_path(battery_id)
    
    if path.exists():
        return battery_id
    
    # Create new battery
    battery = {
        "id": battery_id,
        "serial_number": serial_number,
        "capacity_mah": None,
        "first_seen_date": datetime.now().isoformat(),
        "notes": "",
        "flight_ids": [],
    }
    _save_json(path, battery)
    return battery_id


def link_flight_to_battery(battery_id: str, flight_id: str) -> None:
    if not battery_id:
        return
    path = _battery_path(battery_id)
    battery = _load_json(path) or {"id": battery_id, "flight_ids": []}
    if flight_id not in battery.get("flight_ids", []):
        battery.setdefault("flight_ids", []).append(flight_id)
        _save_json(path, battery)


def get_battery(battery_id: str) -> Optional[Dict[str, Any]]:
    return _load_json(_battery_path(battery_id))


def list_batteries() -> List[Dict[str, Any]]:
    batteries = []
    for bid in _list_ids(BATTERIES_DIR):
        b = get_battery(bid)
        if b:
            # Add computed flight count
            b = dict(b)
            b["flight_count"] = len(b.get("flight_ids", []))
            batteries.append(b)
    return batteries


def update_battery(battery_id: str, **fields) -> bool:
    path = _battery_path(battery_id)
    battery = _load_json(path)
    if not battery:
        return False
    allowed = {"capacity_mah", "notes", "serial_number"}
    for k, v in fields.items():
        if k in allowed:
            battery[k] = v
    _save_json(path, battery)
    return True


def get_battery_flights(battery_id: str) -> List[Dict[str, Any]]:
    battery = get_battery(battery_id)
    if not battery:
        return []
    flights = []
    for fid in battery.get("flight_ids", []):
        f = get_flight(fid)
        if f:
            summary = {k: v for k, v in f.items() if k != 'telemetry'}
            summary['telemetry'] = []
            flights.append(summary)
    return flights


MIN_FLIGHTS_FOR_PREDICTION = 4


def _linear_regression(xs: List[float], ys: List[float]):
    """Ordinary least-squares fit. Returns (slope, intercept, r_squared)."""
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    ss_xx = sum((x - mean_x) ** 2 for x in xs)
    ss_xy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    ss_yy = sum((y - mean_y) ** 2 for y in ys)
    slope = ss_xy / ss_xx if ss_xx > 0 else 0.0
    intercept = mean_y - slope * mean_x
    r_squared = (ss_xy ** 2) / (ss_xx * ss_yy) if ss_xx > 0 and ss_yy > 0 else 0.0
    return slope, intercept, r_squared


def predict_battery_degradation(discharge_rates: List[float], early_avg_rate: float) -> Dict[str, Any]:
    """Project future discharge-rate degradation from a linear trend over recorded
    flights. This is a rough estimate from very few data points, not a guarantee -
    the returned r_squared indicates how well the flights actually fit a straight line."""
    n = len(discharge_rates)
    if n < MIN_FLIGHTS_FOR_PREDICTION or early_avg_rate <= 0:
        return {
            "available": False,
            "reason": f"Need at least {MIN_FLIGHTS_FOR_PREDICTION} flights with telemetry to project a trend (have {n}).",
        }

    xs = list(range(n))
    slope, intercept, r_squared = _linear_regression(xs, discharge_rates)

    if slope <= 0:
        return {
            "available": True,
            "trending_toward_failure": False,
            "slope_pct_per_min_per_flight": round(slope, 4),
            "r_squared": round(r_squared, 2),
            "sample_size": n,
            "reason": "Discharge rate is flat or improving across recorded flights - no degrading trend to project.",
        }

    current_index = n - 1

    def flights_until(threshold_rate: float) -> int:
        crossing_index = (threshold_rate - intercept) / slope
        return max(0, round(crossing_index - current_index))

    return {
        "available": True,
        "trending_toward_failure": True,
        "slope_pct_per_min_per_flight": round(slope, 4),
        "r_squared": round(r_squared, 2),
        "sample_size": n,
        "projected_flights_to_yellow": flights_until(early_avg_rate * 1.10),
        "projected_flights_to_red": flights_until(early_avg_rate * 1.20),
    }


def get_battery_health_stats(battery_id: str) -> Dict[str, Any]:
    """Compute battery health stats across all linked flights."""
    flights = get_battery_flights(battery_id)
    if not flights:
        return {"status": "no_data"}
    
    discharge_rates = []
    voltage_sags = []
    
    for f in flights:
        # Need full telemetry for stats - load it
        full = get_flight(f["id"])
        if not full or not full.get("telemetry"):
            continue
        telemetry = full["telemetry"]
        if len(telemetry) > 1:
            time_span = (telemetry[-1]["timestamp"] - telemetry[0]["timestamp"]) / 60000
            if time_span > 0:
                battery_drop = telemetry[0]["battery_percent"] - telemetry[-1]["battery_percent"]
                discharge_rates.append(battery_drop / time_span)
            
            voltages = [p["cell_voltage"] for p in telemetry if p.get("cell_voltage", 0) > 0]
            if voltages:
                voltage_sags.append(voltages[0] - min(voltages))
    
    if len(discharge_rates) >= 3:
        early_avg = sum(discharge_rates[:2]) / 2
        recent_avg = sum(discharge_rates[-2:]) / 2
        degradation = (recent_avg - early_avg) / early_avg * 100 if early_avg > 0 else 0
    else:
        degradation = 0
        early_avg = recent_avg = sum(discharge_rates) / len(discharge_rates) if discharge_rates else 0
    
    if degradation > 20:
        status = "red"
    elif degradation > 10:
        status = "yellow"
    else:
        status = "green"
    
    return {
        "flight_count": len(flights),
        "avg_discharge_rate": round(sum(discharge_rates) / len(discharge_rates), 3) if discharge_rates else 0,
        "discharge_rates": discharge_rates,
        "avg_voltage_sag": round(sum(voltage_sags) / len(voltage_sags), 3) if voltage_sags else 0,
        "degradation_pct": round(degradation, 1),
        "early_avg_rate": round(early_avg, 3),
        "recent_avg_rate": round(recent_avg, 3),
        "status": status,
        "prediction": predict_battery_degradation(discharge_rates, early_avg),
    }


# ============ AIRCRAFT ============

def _generate_aircraft_id(serial_number: Optional[str]) -> str:
    if serial_number:
        return f"ac_{serial_number}"
    return f"ac_unknown_{datetime.now().strftime('%Y%m%d_%H%M%S')}"


def get_or_create_aircraft(serial_number: Optional[str] = None, model: Optional[str] = None) -> str:
    if not serial_number:
        return ""
    
    aircraft_id = f"ac_{serial_number}"
    path = _aircraft_path(aircraft_id)
    
    if path.exists():
        return aircraft_id
    
    aircraft = {
        "id": aircraft_id,
        "serial_number": serial_number,
        "nickname": None,
        "model": model,
        "service_interval_hours": 25,
        "notes": "",
        "flight_ids": [],
        "maintenance_log": [],
    }
    _save_json(path, aircraft)
    return aircraft_id


def link_flight_to_aircraft(aircraft_id: str, flight_id: str) -> None:
    if not aircraft_id:
        return
    path = _aircraft_path(aircraft_id)
    aircraft = _load_json(path) or {"id": aircraft_id, "flight_ids": []}
    if flight_id not in aircraft.get("flight_ids", []):
        aircraft.setdefault("flight_ids", []).append(flight_id)
        _save_json(path, aircraft)


def get_aircraft(aircraft_id: str) -> Optional[Dict[str, Any]]:
    aircraft = _load_json(_aircraft_path(aircraft_id))
    if not aircraft:
        return None
    # Compute total flight hours from linked flights
    total_seconds = 0
    for fid in aircraft.get("flight_ids", []):
        f = get_flight(fid)
        if f:
            total_seconds += f.get("flight_duration", 0)
    aircraft = dict(aircraft)
    aircraft["total_flight_hours"] = round(total_seconds / 3600, 2)
    aircraft["flight_count"] = len(aircraft.get("flight_ids", []))
    return aircraft


def list_aircraft() -> List[Dict[str, Any]]:
    aircraft = []
    for aid in _list_ids(AIRCRAFT_DIR):
        ac = get_aircraft(aid)
        if ac:
            aircraft.append(ac)
    return aircraft


def update_aircraft(aircraft_id: str, **fields) -> bool:
    path = _aircraft_path(aircraft_id)
    aircraft = _load_json(path)
    if not aircraft:
        return False
    allowed = {"nickname", "model", "service_interval_hours", "notes"}
    for k, v in fields.items():
        if k in allowed:
            aircraft[k] = v
    _save_json(path, aircraft)
    return True


def link_flight(flight_id: str, battery_serial: Optional[str] = None, aircraft_serial: Optional[str] = None) -> Dict[str, str]:
    """Link a flight to battery and aircraft records. Returns IDs used."""
    battery_id = get_or_create_battery(battery_serial) if battery_serial else ""
    aircraft_id = get_or_create_aircraft(aircraft_serial) if aircraft_serial else ""
    
    if battery_id:
        link_flight_to_battery(battery_id, flight_id)
    if aircraft_id:
        link_flight_to_aircraft(aircraft_id, flight_id)
    
    return {"battery_id": battery_id, "aircraft_id": aircraft_id}


# ============ MAINTENANCE LOG ============

def add_maintenance_log(aircraft_id: str, note: str, service_date: Optional[str] = None) -> int:
    aircraft = _load_json(_aircraft_path(aircraft_id))
    if not aircraft:
        raise ValueError("Aircraft not found")
    
    if not service_date:
        service_date = datetime.now().date().isoformat()
    
    log_id = len(aircraft.get("maintenance_log", [])) + 1
    log = {
        "id": log_id,
        "service_date": service_date,
        "note": note,
    }
    aircraft.setdefault("maintenance_log", []).append(log)
    _save_json(_aircraft_path(aircraft_id), aircraft)
    return log_id


def get_maintenance_logs(aircraft_id: str) -> List[Dict[str, Any]]:
    aircraft = _load_json(_aircraft_path(aircraft_id))
    if not aircraft:
        return []
    return aircraft.get("maintenance_log", [])


# ============ FLIGHT TAGS ============

def update_flight_tags(flight_id: str, tags: str) -> bool:
    flight = get_flight(flight_id)
    if not flight:
        return False
    flight["tags"] = tags
    save_flight(flight)
    return True


# ============ SEARCH / FILTER ============

def search_flights(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    aircraft_id: Optional[str] = None,
    battery_id: Optional[str] = None,
    tags: Optional[str] = None,
    free_text: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Filter flights by various criteria."""
    results = []
    for fid in _list_ids(FLIGHTS_DIR):
        f = get_flight(fid)
        if not f:
            continue
        
        # Date range filter
        if date_from and f.get("upload_date", "") < date_from:
            continue
        if date_to and f.get("upload_date", "") > date_to:
            continue
        
        # Aircraft filter
        if aircraft_id and f.get("aircraft_id") != aircraft_id:
            continue
        
        # Battery filter
        if battery_id and f.get("battery_id") != battery_id:
            continue
        
        # Tags filter
        if tags:
            flight_tags = f.get("tags", "").lower()
            if tags.lower() not in flight_tags:
                continue
        
        # Free text search (filename, aircraft)
        if free_text:
            ft = free_text.lower()
            if ft not in f.get("filename", "").lower() and ft not in (f.get("aircraft") or "").lower():
                continue
        
        summary = {k: v for k, v in f.items() if k != 'telemetry'}
        summary['telemetry'] = []
        results.append(summary)
    
    return results


# ============ FLIGHT COMPARISON ============

def get_flights_for_comparison(flight_ids: List[str]) -> List[Dict[str, Any]]:
    """Get full telemetry for multiple flights (for comparison view)."""
    flights = []
    for fid in flight_ids:
        f = get_flight(fid)
        if f:
            flights.append(f)
    return flights


# Initialize directories on import
for d in (DATA_DIR, FLIGHTS_DIR, BATTERIES_DIR, AIRCRAFT_DIR):
    d.mkdir(parents=True, exist_ok=True)