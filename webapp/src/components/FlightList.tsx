import React from 'react'
import { FlightRecord } from './FlightUploader'
import { formatDuration, formatDistance } from '../lib/djiParser'

interface FlightListProps {
  flights: FlightRecord[]
  onSelect: (flight: FlightRecord) => void
  onRemove: (id: string) => void
  onUpload: (files: FileList) => void
}

export function FlightList({ flights, onSelect, onRemove, onUpload }: FlightListProps) {
  return (
    <div className="space-y-6">
      <FlightUploader onUpload={onUpload} />

      {flights.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 2 16.828 5.236 17.657 6.072a8.187 8.187 0 010 12.585z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No flights loaded yet</h3>
          <p className="mt-1 text-gray-500">Upload your DJI .txt flight logs to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Flights ({flights.length})</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {flights.map(flight => (
              <div
                key={flight.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(flight)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 2 16.828 5.236 17.657 6.072a8.187 8.187 0 010 12.585z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{flight.file.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-3">
                        <span>{flight.data.header.format?.toUpperCase()}</span>
                        <span>{formatDuration(flight.data.header.flightDuration)}</span>
                        <span>{flight.data.header.maxAltitude > 0 ? formatDistance(flight.data.header.maxAltitude) + ' max alt' : ''}</span>
                        <span>{flight.data.header.batteryStartPercent > 0 ? flight.data.header.batteryStartPercent + '% → ' + flight.data.header.batteryEndPercent + '%' : ''}</span>
                        {flight.data.header.hasFullTelemetry && (
                          <span className="text-green-600 font-medium">Full telemetry ✓</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(flight.id); }}
                  className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  aria-label="Remove flight"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v12m-6 0h14m0 0l.001-24H5.001" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}