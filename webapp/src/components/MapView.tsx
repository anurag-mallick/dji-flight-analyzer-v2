import React from 'react'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { DJITelemetryPoint } from '../lib/djiParser'

// Fix Leaflet default icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface MapViewProps {
  validPoints: DJITelemetryPoint[]
  currentIndex: number
  mapStyle: string
  onMapStyleChange: (style: string) => void
}

// Google's tile servers are not a documented public API, and using them outside
// Google Maps Platform's own JS/Tile API is against Google's terms of service for
// anything beyond casual personal use. They are offered here only as an opt-in
// convenience for a local hobbyist tool; for production use, switch to the
// official Google Maps Platform Tile API with a billed API key.
const TILE_LAYERS: Record<string, string> = {
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  googleRoadmap: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  googleSatellite: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  googleHybrid: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
}
const GOOGLE_SUBDOMAINS = ['0', '1', '2', '3']

export function MapView({ validPoints, currentIndex, mapStyle, onMapStyleChange }: MapViewProps) {
  if (validPoints.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 2 16.828 5.236 17.657 6.072a8.187 8.187 0 010 12.585z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No GPS data</h3>
        <p className="mt-1 text-gray-500">Full telemetry requires DJI API key + local backend</p>
      </div>
    )
  }

  const lats = validPoints.map(p => p.latitude)
  const lngs = validPoints.map(p => p.longitude)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2
  const isGoogle = mapStyle.startsWith('google')
  const safeIndex = Math.min(currentIndex, validPoints.length - 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Flight Path (2D)</h3>
        <div className="flex items-center gap-2">
          <select
            value={mapStyle}
            onChange={e => onMapStyleChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="osm">OpenStreetMap</option>
            <option value="satellite">Satellite (Esri)</option>
            <option value="terrain">Terrain</option>
            <option value="googleRoadmap">Google Roadmap</option>
            <option value="googleSatellite">Google Satellite</option>
            <option value="googleHybrid">Google Hybrid</option>
          </select>
          <span className="text-sm text-gray-500">{validPoints.length} points</span>
        </div>
      </div>

      <div className="relative h-96">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={16}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            key={mapStyle}
            url={TILE_LAYERS[mapStyle]}
            subdomains={isGoogle ? GOOGLE_SUBDOMAINS : undefined}
            attribution={isGoogle
              ? '&copy; Google'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
          />

          <Polyline
            positions={validPoints.map(p => [p.latitude, p.longitude])}
            color="#3b82f6"
            weight={3}
            opacity={0.8}
            lineCap="round"
            lineJoin="round"
          />

          <Marker position={[validPoints[0].latitude, validPoints[0].longitude]} icon={DefaultIcon}>
            <Popup>Takeoff</Popup>
          </Marker>
          <Marker position={[validPoints[validPoints.length - 1].latitude, validPoints[validPoints.length - 1].longitude]} icon={DefaultIcon}>
            <Popup>Landing</Popup>
          </Marker>

          <CircleMarker
            center={[validPoints[safeIndex].latitude, validPoints[safeIndex].longitude]}
            radius={8}
            color="#3b82f6"
            fillColor="#3b82f6"
            fillOpacity={1}
            weight={3}
          >
            <Popup>
              <div>
                <p>Point {safeIndex + 1} / {validPoints.length}</p>
                <p>Alt: {validPoints[safeIndex].altitude.toFixed(1)} m</p>
                <p>Speed: {validPoints[safeIndex].horizontalSpeed.toFixed(1)} m/s</p>
                <p>Battery: {validPoints[safeIndex].batteryPercent.toFixed(0)}%</p>
              </div>
            </Popup>
          </CircleMarker>
        </MapContainer>
      </div>
    </div>
  )
}
