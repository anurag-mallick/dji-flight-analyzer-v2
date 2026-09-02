// DJI Flight Log Parser - Client-side detection + optional backend decryption
// Supports DJI Fly .txt logs (v12, v13, v14 formats)
// Full telemetry requires DJI API key + local backend

export interface DJILogHeader {
  format: 'v12' | 'v13' | 'v14' | 'unknown';
  aircraft: string;
  serialNumber: string;
  appVersion: string;
  platform: 'iOS' | 'Android' | 'unknown';
  flightStartTime: string;
  flightDuration: number; // seconds
  takeoffLatitude: number;
  takeoffLongitude: number;
  takeoffAltitude: number;
  maxAltitude: number;
  maxDistance: number;
  maxSpeed: number;
  batteryStartPercent: number;
  batteryEndPercent: number;
  captureCount: number;
  videoTime: number;
  fileSize: number;
  hasFullTelemetry: boolean;
  apiKeyRequired: boolean;
}

export interface DJITelemetryPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number;
  horizontalSpeed: number;
  verticalSpeed: number;
  batteryPercent: number;
  cellVoltage: number;
  gpsSats: number;
  gimbalPitch: number;
  gimbalRoll: number;
  gimbalYaw: number;
  rcSignalStrength: number;
  temperature: number;
  // Flight phase detection
  phase: 'takeoff' | 'ascent' | 'cruise' | 'descent' | 'landing' | 'unknown';
}

export interface DJIFlightData {
  header: DJILogHeader;
  telemetry: DJITelemetryPoint[];
  statistics: FlightStatistics;
}

export interface FlightStatistics {
  maxAltitude: number;
  minAltitude: number;
  totalDistance: number;
  maxSpeed: number;
  avgSpeed: number;
  maxVerticalSpeed: number;
  minVerticalSpeed: number;
  maxBattery: number;
  minBattery: number;
  batteryConsumed: number;
  maxGpsSats: number;
  minGpsSats: number;
  maxRcSignal: number;
  minRcSignal: number;
  maxTemperature: number;
  minTemperature: number;
  flightPhases: Record<string, number>; // seconds per phase
  // Battery health
  dischargeRate: number; // % per minute
  estimatedFlightTime: number; // minutes at current rate
}

// Magic bytes for DJI log format detection
const DJI_MAGIC_BYTES = {
  v14: new Uint8Array([0x29, 0x03, 0x00, 0x00]), // )..
  v13: new Uint8Array([0x55, 0xAA, 0x55, 0xAA]), // U.U.
  v12: new Uint8Array([0xAA, 0x55, 0xAA, 0x55]), // .U.U
};

// Known aircraft type mapping
const AIRCRAFT_TYPES: Record<number, string> = {
  68: 'Mavic 3',
  69: 'Mavic 3 Cine',
  70: 'Mavic 3 Classic',
  71: 'Mini 3 Pro',
  72: 'Mini 4 Pro',
  73: 'Mini 5 Pro',
  74: 'Air 3',
  75: 'Air 3S',
  76: 'Mavic 3 Pro',
  77: 'Mavic 3 Pro Cine',
  255: 'Unknown',
};

/**
 * Detect DJI log format from file header bytes
 */
export function detectFormat(buffer: ArrayBuffer): 'v12' | 'v13' | 'v14' | 'unknown' {
  const view = new DataView(buffer);
  const magic = new Uint8Array(buffer, 0, 4);

  if (magic[0] === DJI_MAGIC_BYTES.v14[0] &&
      magic[1] === DJI_MAGIC_BYTES.v14[1] &&
      magic[2] === DJI_MAGIC_BYTES.v14[2] &&
      magic[3] === DJI_MAGIC_BYTES.v14[3]) {
    return 'v14';
  }
  if (magic[0] === DJI_MAGIC_BYTES.v13[0] &&
      magic[1] === DJI_MAGIC_BYTES.v13[1] &&
      magic[2] === DJI_MAGIC_BYTES.v13[2] &&
      magic[3] === DJI_MAGIC_BYTES.v13[3]) {
    return 'v13';
  }
  if (magic[0] === DJI_MAGIC_BYTES.v12[0] &&
      magic[1] === DJI_MAGIC_BYTES.v12[1] &&
      magic[2] === DJI_MAGIC_BYTES.v12[2] &&
      magic[3] === DJI_MAGIC_BYTES.v12[3]) {
    return 'v12';
  }
  return 'unknown';
}

/**
 * Parse basic header info available without API key
 * For v14, this is very limited - just file metadata and format detection
 * Full telemetry requires API key + backend decryption
 */
export function parseBasicHeader(buffer: ArrayBuffer, fileName: string): DJILogHeader {
  const format = detectFormat(buffer);
  const fileSize = buffer.byteLength;

  // Without API key, we can only provide format detection and file info
  // v14 is fully encrypted - no plaintext headers
  // v13/v12 may have some plaintext sections but typically encrypted too
  
  const header: DJILogHeader = {
    format,
    aircraft: format === 'v14' ? 'DJI Mini 5 Pro / Air 3 / Mavic 3 (v14 format)' : 
              format === 'v13' ? 'DJI (v13 format)' : 
              format === 'v12' ? 'DJI (v12 format)' : 'Unknown DJI format',
    serialNumber: 'Encrypted (requires API key)',
    appVersion: 'Unknown',
    platform: 'unknown',
    flightStartTime: new Date().toISOString(),
    flightDuration: 0,
    takeoffLatitude: 0,
    takeoffLongitude: 0,
    takeoffAltitude: 0,
    maxAltitude: 0,
    maxDistance: 0,
    maxSpeed: 0,
    batteryStartPercent: 0,
    batteryEndPercent: 0,
    captureCount: 0,
    videoTime: 0,
    fileSize,
    hasFullTelemetry: false,
    apiKeyRequired: format !== 'unknown',
  };

  // Try to extract any plaintext strings for v12/v13
  if (format === 'v12' || format === 'v13') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('aircraft:')) header.aircraft = trimmed.replace('aircraft:', '').trim();
      else if (trimmed.startsWith('serialNumber:')) header.serialNumber = trimmed.replace('serialNumber:', '').trim();
      else if (trimmed.startsWith('flightDuration:')) header.flightDuration = parseInt(trimmed.replace('flightDuration:', '').trim(), 10);
      // ... other fields
    }
  }

  return header;
}

/**
 * Calculate statistics from telemetry points
 */
export function calculateStatistics(telemetry: DJITelemetryPoint[]): FlightStatistics {
  if (telemetry.length === 0) {
    return emptyStatistics();
  }

  const altitudes = telemetry.map(p => p.altitude);
  const speeds = telemetry.map(p => p.horizontalSpeed);
  const vSpeeds = telemetry.map(p => p.verticalSpeed);
  const batteries = telemetry.map(p => p.batteryPercent);
  const gpsSats = telemetry.map(p => p.gpsSats);
  const rcSignals = telemetry.map(p => p.rcSignalStrength);
  const temps = telemetry.map(p => p.temperature);

  // Flight phase duration
  const phaseCounts: Record<string, number> = {};
  telemetry.forEach(p => {
    phaseCounts[p.phase] = (phaseCounts[p.phase] || 0) + 1;
  });
  const phaseDurations: Record<string, number> = {};
  Object.entries(phaseCounts).forEach(([phase, count]) => {
    phaseDurations[phase] = count; // assuming 1Hz sampling
  });

  // Battery discharge rate (% per minute)
  const timeSpanMinutes = (telemetry[telemetry.length - 1]?.timestamp - telemetry[0]?.timestamp) / 60000 || 1;
  const batteryDrop = (telemetry[0]?.batteryPercent || 100) - (telemetry[telemetry.length - 1]?.batteryPercent || 0);
  const dischargeRate = batteryDrop / timeSpanMinutes;

  return {
    maxAltitude: Math.max(...altitudes),
    minAltitude: Math.min(...altitudes),
    totalDistance: calculateTotalDistance(telemetry),
    maxSpeed: Math.max(...speeds),
    avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
    maxVerticalSpeed: Math.max(...vSpeeds),
    minVerticalSpeed: Math.min(...vSpeeds),
    maxBattery: Math.max(...batteries),
    minBattery: Math.min(...batteries),
    batteryConsumed: batteryDrop,
    maxGpsSats: Math.max(...gpsSats),
    minGpsSats: Math.min(...gpsSats),
    maxRcSignal: Math.max(...rcSignals),
    minRcSignal: Math.min(...rcSignals),
    maxTemperature: Math.max(...temps),
    minTemperature: Math.min(...temps),
    flightPhases: phaseDurations,
    dischargeRate,
    estimatedFlightTime: dischargeRate > 0 ? (telemetry[telemetry.length - 1]?.batteryPercent || 0) / dischargeRate : 0,
  };
}

function emptyStatistics(): FlightStatistics {
  return {
    maxAltitude: 0, minAltitude: 0, totalDistance: 0,
    maxSpeed: 0, avgSpeed: 0, maxVerticalSpeed: 0, minVerticalSpeed: 0,
    maxBattery: 0, minBattery: 0, batteryConsumed: 0,
    maxGpsSats: 0, minGpsSats: 0,
    maxRcSignal: 0, minRcSignal: 0,
    maxTemperature: 0, minTemperature: 0,
    flightPhases: {}, dischargeRate: 0, estimatedFlightTime: 0,
  };
}

function calculateTotalDistance(telemetry: DJITelemetryPoint[]): number {
  let distance = 0;
  for (let i = 1; i < telemetry.length; i++) {
    const p1 = telemetry[i - 1];
    const p2 = telemetry[i];
    distance += haversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
  }
  return distance;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

/**
 * Detect flight phase from telemetry
 */
export function detectFlightPhase(point: DJITelemetryPoint, prevPoint?: DJITelemetryPoint): DJITelemetryPoint['phase'] {
  const alt = point.altitude;
  const vSpeed = point.verticalSpeed;
  const hSpeed = point.horizontalSpeed;

  if (!prevPoint) {
    if (alt < 5 && hSpeed < 1) return 'takeoff';
    return 'unknown';
  }

  const altChange = alt - prevPoint.altitude;
  
  if (alt < 3 && hSpeed < 1 && vSpeed <= 0) return 'landing';
  if (alt < 10 && vSpeed > 1) return 'takeoff';
  if (vSpeed > 0.5) return 'ascent';
  if (vSpeed < -0.5) return 'descent';
  if (hSpeed > 2) return 'cruise';
  return 'cruise';
}

/**
 * Main entry point: parse a DJI log file
 * Returns header info immediately; full telemetry requires backend
 */
export async function parseDJILog(file: File, apiKey?: string): Promise<{
  header: DJILogHeader;
  telemetry: DJITelemetryPoint[];
  statistics: FlightStatistics;
  backendRequired: boolean;
}> {
  const buffer = await file.arrayBuffer();
  const header = parseBasicHeader(buffer, file.name);

  // Without API key or backend, return header only
  if (!apiKey || header.format === 'unknown') {
    return {
      header,
      telemetry: [],
      statistics: emptyStatistics(),
      backendRequired: header.apiKeyRequired,
    };
  }

  // With API key, would call local backend
  // For now, return header only and indicate backend needed
  return {
    header,
    telemetry: [],
    statistics: emptyStatistics(),
    backendRequired: true,
  };
}

/**
 * Format helpers for UI
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatSpeed(ms: number): string {
  return `${ms.toFixed(1)} m/s (${(ms * 3.6).toFixed(1)} km/h)`;
}

export function formatAltitude(meters: number): string {
  return `${meters.toFixed(1)} m`;
}

export function formatBattery(percent: number): string {
  return `${percent.toFixed(1)}%`;
}