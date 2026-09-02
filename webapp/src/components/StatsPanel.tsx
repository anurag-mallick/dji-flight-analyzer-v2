import React from 'react'
import { DJILogHeader, FlightStatistics } from '../lib/djiParser'

interface StatsPanelProps {
  header: DJILogHeader
  statistics: FlightStatistics
}

export function StatsPanel({ header, statistics }: StatsPanelProps) {
  const hasData = statistics.maxAltitude > 0 || statistics.totalDistance > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Flight Statistics</h3>
      
      {!hasData ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 19v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="mt-2">No telemetry data available</p>
          <p className="text-xs mt-1">Requires DJI API key + local backend for full decryption</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatRow label="Max Altitude" value={`${statistics.maxAltitude.toFixed(1)} m`} />
            <StatRow label="Min Altitude" value={`${statistics.minAltitude.toFixed(1)} m`} />
            <StatRow label="Total Distance" value={`${(statistics.totalDistance / 1000).toFixed(2)} km`} />
            <StatRow label="Max Speed" value={`${statistics.maxSpeed.toFixed(1)} m/s (${(statistics.maxSpeed * 3.6).toFixed(1)} km/h)`} />
            <StatRow label="Avg Speed" value={`${statistics.avgSpeed.toFixed(1)} m/s`} />
            <StatRow label="Max Vert. Speed" value={`${statistics.maxVerticalSpeed.toFixed(1)} m/s`} />
            <StatRow label="Min Vert. Speed" value={`${statistics.minVerticalSpeed.toFixed(1)} m/s`} />
            <StatRow label="Battery Used" value={`${statistics.batteryConsumed.toFixed(1)}%`} />
            <StatRow label="Discharge Rate" value={`${statistics.dischargeRate.toFixed(2)}%/min`} />
            <StatRow label="Est. Flight Time" value={`${statistics.estimatedFlightTime.toFixed(0)} min`} />
            <StatRow label="Max GPS Sats" value={statistics.maxGpsSats.toString()} />
            <StatRow label="Min GPS Sats" value={statistics.minGpsSats.toString()} />
            <StatRow label="Max RC Signal" value={`${statistics.maxRcSignal.toFixed(0)}%`} />
            <StatRow label="Min RC Signal" value={`${statistics.minRcSignal.toFixed(0)}%`} />
            <StatRow label="Max Temp" value={`${statistics.maxTemperature.toFixed(1)}°C`} />
            <StatRow label="Min Temp" value={`${statistics.minTemperature.toFixed(1)}°C`} />
          </div>

          {Object.keys(statistics.flightPhases).length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-700 mb-2">Flight Phases</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statistics.flightPhases).map(([phase, duration]) => (
                  <div key={phase} className="flex justify-between text-sm">
                    <span className="capitalize text-gray-600">{phase}</span>
                    <span className="font-medium">{duration}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}