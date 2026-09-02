import React, { useMemo, useState } from 'react'
import { DJITelemetryPoint, PointOfInterest } from '../lib/djiParser'
import { MapView } from './MapView'
import { Map3DView } from './Map3DView'
import { PlaybackControls } from './PlaybackControls'

interface FlightMapSectionProps {
  telemetry: DJITelemetryPoint[]
  pois: PointOfInterest[]
}

export function FlightMapSection({ telemetry, pois }: FlightMapSectionProps) {
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [mapStyle, setMapStyle] = useState('osm')
  const [currentIndex, setCurrentIndex] = useState(0)

  const validPoints = useMemo(
    () => telemetry.filter(p => p.latitude !== 0 && p.longitude !== 0),
    [telemetry]
  )
  const safeIndex = Math.min(currentIndex, Math.max(validPoints.length - 1, 0))

  return (
    <div>
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-3 w-fit">
        <button
          onClick={() => setMode('2d')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === '2d' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          2D Map
        </button>
        <button
          onClick={() => setMode('3d')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === '3d' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          3D Flight Path
        </button>
      </div>

      {mode === '2d' ? (
        <MapView validPoints={validPoints} currentIndex={safeIndex} mapStyle={mapStyle} onMapStyleChange={setMapStyle} pois={pois} />
      ) : (
        <Map3DView validPoints={validPoints} currentIndex={safeIndex} pois={pois} />
      )}

      <PlaybackControls points={validPoints} currentIndex={safeIndex} onSeek={setCurrentIndex} />
    </div>
  )
}
