import React from 'react'
import { DJILogHeader } from '../lib/djiParser'

interface FlightDetailProps {
  flight: {
    id: string
    file: File
    data: { header: DJILogHeader }
    loadedAt: Date
  }
}

export function FlightDetail({ flight }: FlightDetailProps) {
  const { header } = flight.data

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{flight.file.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Loaded {flight.loadedAt.toLocaleString()}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          header.hasFullTelemetry ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
        }`}>
          {header.hasFullTelemetry ? 'Full Telemetry' : 'Header Only'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Aircraft" value={header.aircraft} />
        <StatCard label="Format" value={header.format?.toUpperCase() || 'Unknown'} />
        <StatCard label="Duration" value={formatDuration(header.flightDuration)} />
        <StatCard label="File Size" value={formatFileSize(header.fileSize)} />
        <StatCard label="Max Altitude" value={header.maxAltitude > 0 ? `${header.maxAltitude.toFixed(1)} m` : '—'} />
        <StatCard label="Max Distance" value={header.maxDistance > 0 ? `${header.maxDistance.toFixed(1)} m` : '—'} />
        <StatCard label="Max Speed" value={header.maxSpeed > 0 ? `${header.maxSpeed.toFixed(1)} m/s` : '—'} />
        <StatCard label="Battery" value={header.batteryStartPercent > 0 ? `${header.batteryStartPercent}% → ${header.batteryEndPercent}%` : '—'} />
        <StatCard label="Captures" value={header.captureCount > 0 ? header.captureCount.toString() : '—'} />
        <StatCard label="Video Time" value={header.videoTime > 0 ? formatDuration(header.videoTime) : '—'} />
        <StatCard label="Takeoff" value={header.takeoffLatitude && header.takeoffLongitude ? `${header.takeoffLatitude.toFixed(6)}, ${header.takeoffLongitude.toFixed(6)}` : '—'} />
        <StatCard label="Serial" value={header.serialNumber} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900 truncate">{value}</p>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}