import React, { useState } from 'react'
import { BackendFlightSummary, formatDuration } from '../lib/djiParser'

interface FlightDetailProps {
  header: BackendFlightSummary
  onTagsUpdated: (flightId: string, tags: string) => void
}

export function FlightDetail({ header, onTagsUpdated }: FlightDetailProps) {
  const [editingTags, setEditingTags] = useState(false)
  const [tagsInput, setTagsInput] = useState(header.tags || '')
  const [saving, setSaving] = useState(false)

  const saveTags = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/flights/${header.id}/tags?tags=${encodeURIComponent(tagsInput)}`, {
        method: 'PATCH',
      })
      if (res.ok) {
        onTagsUpdated(header.id, tagsInput)
        setEditingTags(false)
      }
    } catch {
      // best-effort; leave the editor open so the user can retry
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{header.filename}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {header.upload_date ? `Uploaded ${new Date(header.upload_date).toLocaleString()}` : 'Not yet persisted'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          header.has_full_telemetry ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
        }`}>
          {header.has_full_telemetry ? 'Full Telemetry' : 'Header Only'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Aircraft" value={header.aircraft} />
        <StatCard label="Format" value={header.format?.toUpperCase() || 'Unknown'} />
        <StatCard label="Duration" value={formatDuration(header.flight_duration)} />
        <StatCard label="GPS Points" value={header.gps_point_count.toString()} />
        <StatCard label="Max Altitude" value={header.max_altitude > 0 ? `${header.max_altitude.toFixed(1)} m` : '—'} />
        <StatCard label="Max Distance" value={header.max_distance > 0 ? `${header.max_distance.toFixed(1)} m` : '—'} />
        <StatCard label="Max Speed" value={header.max_speed > 0 ? `${header.max_speed.toFixed(1)} m/s` : '—'} />
        <StatCard label="Battery" value={header.battery_start > 0 ? `${header.battery_start}% → ${header.battery_end}%` : '—'} />
      </div>

      {header.firmware && Object.keys(header.firmware).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Firmware Versions</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(header.firmware).map(([component, version]) => (
              <div key={component} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 capitalize">{component.toLowerCase().replace('_', ' ')}</p>
                <p className="text-sm font-medium text-gray-900">{version}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tags</p>
        {editingTags ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="e.g. site-survey, mapping, client-x"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={saveTags}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditingTags(false); setTagsInput(header.tags || '') }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {header.tags ? (
              header.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                <span key={t} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">{t}</span>
              ))
            ) : (
              <span className="text-sm text-gray-400">No tags yet</span>
            )}
            <button onClick={() => setEditingTags(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Edit
            </button>
          </div>
        )}
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
