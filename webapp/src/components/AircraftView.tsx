import React, { useCallback, useEffect, useState } from 'react'

interface Aircraft {
  id: string
  nickname: string | null
  model: string | null
  serial_number: string | null
  total_flight_hours: number
  service_interval_hours: number
  notes: string | null
  flight_count: number
}

interface MaintenanceLog {
  id: number
  aircraft_id: string
  service_date: string
  note: string
}

function maintenanceStatus(aircraft: Aircraft): { label: string; className: string } {
  if (!aircraft.service_interval_hours || aircraft.service_interval_hours <= 0) {
    return { label: 'No interval set', className: 'bg-gray-100 text-gray-600' }
  }
  const ratio = aircraft.total_flight_hours / aircraft.service_interval_hours
  if (ratio >= 1) return { label: 'Service overdue', className: 'bg-red-100 text-red-800' }
  if (ratio >= 0.9) return { label: 'Service due soon', className: 'bg-amber-100 text-amber-800' }
  return { label: 'Within interval', className: 'bg-green-100 text-green-800' }
}

export function AircraftView() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Aircraft | null>(null)

  const fetchAircraft = useCallback(async () => {
    try {
      const res = await fetch('/api/aircraft')
      setAircraft(res.ok ? await res.json() : [])
    } catch {
      setAircraft([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAircraft() }, [fetchAircraft])

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-500">Loading fleet...</p>
      </div>
    )
  }

  if (aircraft.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">No aircraft tracked yet</h3>
        <p className="mt-1 text-gray-500">Aircraft are automatically created from serial numbers found in uploaded flight logs.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {aircraft.map(a => {
        const status = maintenanceStatus(a)
        return (
          <div
            key={a.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 cursor-pointer transition-colors"
            onClick={() => setSelected(a)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{a.nickname || a.model || a.serial_number}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>{status.label}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{a.model || 'Unknown model'} · {a.flight_count} flights · {a.total_flight_hours.toFixed(1)}h total</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            {a.service_interval_hours > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${status.label === 'Service overdue' ? 'bg-red-500' : status.label === 'Service due soon' ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, (a.total_flight_hours / a.service_interval_hours) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{a.total_flight_hours.toFixed(1)}h / {a.service_interval_hours}h service interval</p>
              </div>
            )}
          </div>
        )
      })}

      {selected && (
        <AircraftDetail
          aircraft={selected}
          onClose={() => setSelected(null)}
          onUpdated={updated => {
            setAircraft(prev => prev.map(a => a.id === updated.id ? updated : a))
            setSelected(updated)
          }}
        />
      )}
    </div>
  )
}

function AircraftDetail({ aircraft, onClose, onUpdated }: {
  aircraft: Aircraft
  onClose: () => void
  onUpdated: (a: Aircraft) => void
}) {
  const [nickname, setNickname] = useState(aircraft.nickname || '')
  const [interval, setIntervalHours] = useState(aircraft.service_interval_hours || 25)
  const [notes, setNotes] = useState(aircraft.notes || '')
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/aircraft/${aircraft.id}/maintenance`)
      setLogs(res.ok ? await res.json() : [])
    } catch {
      setLogs([])
    }
  }, [aircraft.id])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const saveDetails = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/aircraft/${aircraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, service_interval_hours: interval, notes }),
      })
      if (res.ok) onUpdated(await res.json())
    } finally {
      setSaving(false)
    }
  }

  const addLog = async () => {
    if (!newNote.trim()) return
    const res = await fetch(`/api/aircraft/${aircraft.id}/maintenance?note=${encodeURIComponent(newNote)}`, { method: 'POST' })
    if (res.ok) {
      setNewNote('')
      fetchLogs()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">{aircraft.nickname || aircraft.model || aircraft.serial_number}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
              <input value={nickname} onChange={e => setNickname(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={aircraft.model || 'Aircraft nickname'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service interval (hours)</label>
              <input type="number" value={interval} onChange={e => setIntervalHours(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" rows={2} />
          </div>
          <button onClick={saveDetails} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Maintenance Log</h3>
            <div className="flex gap-2 mb-4">
              <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="e.g. Replaced propellers, calibrated gimbal" className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
              <button onClick={addLog} className="px-3 py-2 bg-gray-900 text-white rounded-md text-sm">Add</button>
            </div>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-400">No maintenance logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {logs.slice().reverse().map(log => (
                  <li key={log.id} className="text-sm border border-gray-100 rounded-lg p-3">
                    <span className="text-gray-400 mr-2">{log.service_date}</span>
                    <span className="text-gray-900">{log.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
