import React, { useCallback } from 'react'
import { DJIFlightData, DJITelemetryPoint, DJILogHeader } from '../lib/djiParser'

interface ExportPanelProps {
  flightData: DJIFlightData
}

export function ExportPanel({ flightData }: ExportPanelProps) {
  const { header, telemetry, statistics } = flightData
  const hasTelemetry = telemetry.length > 0

  const downloadBlob = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportJSON = useCallback(() => {
    const output = {
      header,
      statistics,
      telemetry: hasTelemetry ? telemetry : undefined,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }
    downloadBlob(JSON.stringify(output, null, 2), `dji-flight-${header.aircraft?.replace(/\s+/g, '-') || 'unknown'}-${Date.now()}.json`, 'application/json')
  }, [header, telemetry, statistics, hasTelemetry, downloadBlob])

  const exportCSV = useCallback(() => {
    if (!hasTelemetry) return
    const headers = [
      'timestamp', 'latitude', 'longitude', 'altitude',
      'horizontalSpeed', 'verticalSpeed', 'batteryPercent',
      'cellVoltage', 'gpsSats', 'gimbalPitch', 'gimbalRoll', 'gimbalYaw',
      'rcSignalStrength', 'temperature', 'phase'
    ]
    const rows = telemetry.map(p => [
      p.timestamp, p.latitude, p.longitude, p.altitude,
      p.horizontalSpeed, p.verticalSpeed, p.batteryPercent,
      p.cellVoltage, p.gpsSats, p.gimbalPitch, p.gimbalRoll, p.gimbalYaw,
      p.rcSignalStrength, p.temperature, p.phase
    ].join(','))
    downloadBlob([headers.join(','), ...rows].join('\n'), `dji-flight-${Date.now()}.csv`, 'text/csv')
  }, [telemetry, hasTelemetry, downloadBlob])

  const exportKML = useCallback(() => {
    if (!hasTelemetry) return
    const coords = telemetry.map(p => `${p.longitude},${p.latitude},${p.altitude}`).join(' ')
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${header.aircraft} Flight</name>
  <Style id="flightStyle"><LineStyle><color>ff0000ff</color><width>4</width></LineStyle></Style>
  <Placemark>
    <name>Flight Path</name>
    <styleUrl>#flightStyle</styleUrl>
    <LineString><tessellate>1</tessellate><coordinates>${coords}</coordinates></LineString>
  </Placemark>
  <Placemark>
    <name>Takeoff</name>
    <Point><coordinates>${telemetry[0].longitude},${telemetry[0].latitude},${telemetry[0].altitude}</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>Landing</name>
    <Point><coordinates>${telemetry[telemetry.length-1].longitude},${telemetry[telemetry.length-1].latitude},${telemetry[telemetry.length-1].altitude}</coordinates></Point>
  </Placemark>
</Document>
</kml>`
    downloadBlob(kml, `dji-flight-${Date.now()}.kml`, 'application/vnd.google-earth.kml+xml')
  }, [telemetry, header, hasTelemetry, downloadBlob])

  const exportGeoJSON = useCallback(() => {
    if (!hasTelemetry) return
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: telemetry.map(p => [p.longitude, p.latitude, p.altitude]),
          },
          properties: {
            aircraft: header.aircraft,
            maxAltitude: header.maxAltitude,
            maxSpeed: header.maxSpeed,
            flightDuration: header.flightDuration,
            batteryStart: header.batteryStartPercent,
            batteryEnd: header.batteryEndPercent,
            gpsPointCount: telemetry.length,
          },
        },
      ],
    }
    downloadBlob(JSON.stringify(geojson, null, 2), `dji-flight-${Date.now()}.geojson`, 'application/geo+json')
  }, [telemetry, header, hasTelemetry, downloadBlob])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h3>
      
      {!hasTelemetry ? (
        <div className="text-center py-6 text-gray-500">
          <p>No telemetry data to export</p>
          <p className="text-xs mt-1">Requires full telemetry decryption</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={exportJSON} className="export-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span>JSON</span>
            <span className="text-xs opacity-70">Full data + stats</span>
          </button>
          <button onClick={exportCSV} className="export-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span>CSV</span>
            <span className="text-xs opacity-70">Spreadsheet ready</span>
          </button>
          <button onClick={exportKML} className="export-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 2 16.828 5.236 17.657 6.072a8.187 8.187 0 010 12.585z" /></svg>
            <span>KML</span>
            <span className="text-xs opacity-70">Google Earth</span>
          </button>
          <button onClick={exportGeoJSON} className="export-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span>GeoJSON</span>
            <span className="text-xs opacity-70">GIS compatible</span>
          </button>
        </div>
      )}
    </div>
  )
}

function ExportButton({ onClick, icon: Icon, label, description }: { 
  onClick: () => void
  icon: React.FC<{className?: string}>
  label: string
  description: string
}) {
  return (
    <button onClick={onClick} className="export-btn flex-col items-start gap-1">
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
      <span className="text-xs opacity-70">{description}</span>
    </button>
  )
}