import React, { useState } from 'react'
import { FlightUploader } from './FlightUploader'
import { BackendFlightSummary, formatDuration, formatDistance } from '../lib/djiParser'

export interface PendingUpload {
  tempId: string
  filename: string
  status: 'uploading' | 'error'
  error?: string
}

interface FlightListProps {
  flights: BackendFlightSummary[]
  pending: PendingUpload[]
  onSelect: (flight: BackendFlightSummary) => void
  onRemove: (id: string) => void
  onUpload: (files: FileList) => void
  onSearch: (query: string) => void
  selectedForCompare: string[]
  onToggleCompare: (id: string) => void
}

export function FlightList({
  flights, pending, onSelect, onRemove, onUpload, onSearch,
  selectedForCompare, onToggleCompare,
}: FlightListProps) {
  const [query, setQuery] = useState('')

  const handleSearchChange = (value: string) => {
    setQuery(value)
    onSearch(value)
  }

  const isEmpty = flights.length === 0 && pending.length === 0

  return (
    <div className="space-y-6">
      <FlightUploader onUpload={onUpload} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search by filename, aircraft, or tag..."
          className="flex-1 text-sm focus:outline-none"
        />
        {selectedForCompare.length > 0 && (
          <span className="text-xs text-blue-600 font-medium">
            {selectedForCompare.length} selected for comparison
          </span>
        )}
      </div>

      {isEmpty ? (
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
            {pending.map(p => (
              <div key={p.tempId} className="px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {p.status === 'uploading' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  ) : (
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.filename}</p>
                  <p className="text-xs text-gray-500">
                    {p.status === 'uploading' ? 'Uploading and decrypting...' : (p.error || 'Upload failed')}
                  </p>
                </div>
              </div>
            ))}
            {flights.map(flight => (
              <div
                key={flight.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
              >
                <input
                  type="checkbox"
                  checked={selectedForCompare.includes(flight.id)}
                  onChange={() => onToggleCompare(flight.id)}
                  onClick={e => e.stopPropagation()}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  title="Select for comparison"
                />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(flight)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 2 16.828 5.236 17.657 6.072a8.187 8.187 0 010 12.585z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{flight.filename}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                        <span>{flight.aircraft}</span>
                        <span>{flight.format?.toUpperCase()}</span>
                        <span>{formatDuration(flight.flight_duration)}</span>
                        {flight.max_altitude > 0 && <span>{formatDistance(flight.max_altitude)} max alt</span>}
                        {flight.battery_start > 0 && <span>{flight.battery_start}% &rarr; {flight.battery_end}%</span>}
                        {flight.has_full_telemetry && (
                          <span className="text-green-600 font-medium">Full telemetry &#10003;</span>
                        )}
                        {flight.tags && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{flight.tags}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(flight.id); }}
                  className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
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
