import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet'
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

// Playback scrubber component
function PlaybackScrubber({ telemetry, currentIndex, onSeek }: { 
  telemetry: DJITelemetryPoint[]
  currentIndex: number
  onSeek: (index: number) => void
}) {
  if (telemetry.length === 0) return null

  const current = telemetry[currentIndex]
  const progress = telemetry.length > 1 ? (currentIndex / (telemetry.length - 1)) * 100 : 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => onSeek(0)} className="p-2 text-gray-500 hover:text-gray-700" title="Start">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6V18z"/></svg>
        </button>
        <button onClick={() => onSeek(Math.max(0, currentIndex - 1))} className="p-2 text-gray-500 hover:text-gray-700" title="Step back">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18l-6-6 6-6v12zm8 0l-6-6 6-6v12z"/></svg>
        </button>
        <button onClick={() => onSeek(Math.min(telemetry.length - 1, currentIndex + 1))} className="p-2 text-gray-500 hover:text-gray-700" title="Step forward">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 18l6-6-6-6v12zm-8 0l6-6-6-6v12z"/></svg>
        </button>
        <button onClick={() => onSeek(telemetry.length - 1)} className="p-2 text-gray-500 hover:text-gray-700" title="End">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6v12l8.5-6L12 6z"/></svg>
        </button>
        <div className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer relative" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const percent = (e.clientX - rect.left) / rect.width
          onSeek(Math.round(percent * (telemetry.length - 1)))
        }}>
          <div className="h-full bg-blue-600 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-md" style={{ left: `${progress}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
        <div>Alt: {current?.altitude?.toFixed(1) ?? '—'} m</div>
        <div>Speed: {current?.horizontalSpeed?.toFixed(1) ?? '—'} m/s</div>
        <div>Bat: {current?.batteryPercent?.toFixed(0) ?? '—'}%</div>
        <div>Sats: {current?.gpsSats ?? '—'}</div>
      </div>
    </div>
  )
}

export function MapView({ telemetry }: { telemetry: DJITelemetryPoint[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mapStyle, setMapStyle] = useState('osm')

  const validPoints = telemetry.filter(p => p.latitude !== 0 && p.longitude !== 0)
  
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

  // Calculate bounds
  const lats = validPoints.map(p => p.latitude)
  const lngs = validPoints.map(p => p.longitude)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2

  const tileLayers = {
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Flight Path</h3>
        <div className="flex items-center gap-2">
          <select
            value={mapStyle}
            onChange={e => setMapStyle(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="osm">OpenStreetMap</option>
            <option value="satellite">Satellite</option>
            <option value="terrain">Terrain</option>
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
            url={tileLayers[mapStyle]}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <Polyline
            positions={validPoints.map(p => [p.latitude, p.longitude])}
            color="#3b82f6"
            weight={3}
            opacity={0.8}
            lineCap="round"
            lineJoin="round"
          />
          
          {validPoints.length > 0 && (
            <>
              <Marker position={[validPoints[0].latitude, validPoints[0].longitude]} icon={DefaultIcon}>
                <Popup>Takeoff</Popup>
              </Marker>
              <Marker position={[validPoints[validPoints.length - 1].latitude, validPoints[validPoints.length - 1].longitude]} icon={DefaultIcon}>
                <Popup>Landing</Popup>
              </Marker>
              
              <CircleMarker
                center={[validPoints[currentIndex].latitude, validPoints[currentIndex].longitude]}
                radius={8}
                color="#3b82f6"
                fillColor="#3b82f6"
                fillOpacity={1}
                weight={3}
              >
                <Popup>
                  <div>
                    <p>Point {currentIndex + 1} / {validPoints.length}</p>
                    <p>Alt: {validPoints[currentIndex].altitude.toFixed(1)} m</p>
                    <p>Speed: {validPoints[currentIndex].horizontalSpeed.toFixed(1)} m/s</p>
                    <p>Battery: {validPoints[currentIndex].batteryPercent.toFixed(0)}%</p>
                  </div>
                </Popup>
              </CircleMarker>
            </>
          )}
        </MapContainer>
      </div>

      <PlaybackScrubber 
        telemetry={validPoints} 
        currentIndex={currentIndex} 
        onSeek={setCurrentIndex} 
      />
    </div>
  )
}