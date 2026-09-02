import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'

interface Battery {
  id: string
  serial_number: string
  capacity_mah: number | null
  first_seen_date: string
  notes: string
  flight_ids: string[]
  flight_count: number
}

interface BatteryHealth {
  flight_count: number
  avg_discharge_rate: number
  discharge_rates: number[]
  avg_voltage_sag: number
  degradation_pct: number
  early_avg_rate: number
  recent_avg_rate: number
  status: 'green' | 'yellow' | 'red'
}

interface FlightSummary {
  id: string
  filename: string
  aircraft: string
  format: string
  flight_duration: number
  max_altitude: number
  max_distance: number
  max_speed: number
  battery_start: number
  battery_end: number
  has_full_telemetry: boolean
  gps_point_count: number
  upload_date: string
  battery_id: string
  aircraft_id: string
}

interface BatteryDetailProps {
  battery: Battery
  onClose: () => void
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

export function BatteryDetail({ battery, onClose }: BatteryDetailProps) {
  const [health, setHealth] = useState<BatteryHealth | null>(null)
  const [flights, setFlights] = useState<FlightSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [capacity, setCapacity] = useState(battery.capacity_mah ? String(battery.capacity_mah) : '')
  const [notes, setNotes] = useState(battery.notes || '')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [h, f] = await Promise.all([
          fetch(`/api/batteries/${battery.id}/health`).then(r => r.ok ? r.json() : null),
          fetch(`/api/batteries/${battery.id}/flights`).then(r => r.ok ? r.json() : []),
        ])
        setHealth(h)
        setFlights(f || [])
      } catch (e) {
        console.error('Failed to load battery data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [battery.id])

  const saveBattery = async () => {
    try {
      const res = await fetch(`/api/batteries/${battery.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity_mah: capacity ? parseInt(capacity) : null, notes }),
      })
      if (res.ok) {
        alert('Battery updated')
      }
    } catch (e) {
      alert('Failed to update battery')
    }
  }

  const statusColors = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  }

  const statusLabels = {
    green: 'Healthy',
    yellow: 'Degrading',
    red: 'Replace Soon',
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading battery data...</p>
        </div>
      </div>
    )
  }

  const dischargeData = health?.discharge_rates.map((rate, i) => ({
    flight: i + 1,
    rate: rate.toFixed(2),
  })) || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Battery: {battery.serial_number}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {battery.capacity_mah ? `${battery.capacity_mah} mAh • ` : ''}{battery.flight_count} flights • First seen: {new Date(battery.first_seen_date).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Health Status Card */}
          {health && (
            <div className={`${statusColors[health.status]} rounded-xl p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Battery Health Status</h3>
                  <p className="text-sm opacity-80 mt-1">{statusLabels[health.status]}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{health.degradation_pct > 0 ? '+' : ''}{health.degradation_pct.toFixed(1)}%</p>
                  <p className="text-sm opacity-80">Discharge rate degradation</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="opacity-70">Avg Discharge Rate</p>
                  <p className="font-medium">{health.avg_discharge_rate.toFixed(2)}%/min</p>
                </div>
                <div>
                  <p className="opacity-70">Avg Voltage Sag</p>
                  <p className="font-medium">{health.avg_voltage_sag.toFixed(3)}V</p>
                </div>
                <div>
                  <p className="opacity-70">Early Flights Rate</p>
                  <p className="font-medium">{health.early_avg_rate.toFixed(2)}%/min</p>
                </div>
                <div>
                  <p className="opacity-70">Recent Flights Rate</p>
                  <p className="font-medium">{health.recent_avg_rate.toFixed(2)}%/min</p>
                </div>
              </div>
            </div>
          )}

          {/* Battery Info Editor */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Battery Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (mAh)</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 3000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <button onClick={saveBattery} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
              Save Changes
            </button>
          </div>

          {/* Discharge Rate Trend Chart */}
          {health && health.discharge_rates.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Discharge Rate Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={health.discharge_rates.map((rate, i) => ({ flight: i + 1, rate: rate.toFixed(2) }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dischargeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="flight" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} name="Flight #" />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={60} name="%/min" />
                  <Tooltip />
                  <Area type="monotone" dataKey="rate" fill="url(#dischargeGradient)" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Each point = one flight. Rising trend = faster discharge = degradation.
              </p>
            </div>
          )}

          {/* Flight History Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Flight History ({flights.length} flights)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flight</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Battery</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Alt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telemetry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {flights.map(flight => (
                    <tr key={flight.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{new Date(flight.upload_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium truncate max-w-xs">{flight.filename}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {Math.floor(flight.flight_duration / 60)}m {flight.flight_duration % 60}s
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {flight.battery_start}% → {flight.battery_end}%
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{flight.max_altitude.toFixed(1)} m</td>
                      <td className="px-4 py-3 text-sm">
                        {flight.has_full_telemetry ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Full ({flight.gps_point_count} pts)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Header only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BatteryListItem({ battery, health, onClick }: { battery: Battery; health: BatteryHealth; onClick: () => void }) {
  const statusColors = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  }

  const statusLabels = {
    green: 'Healthy',
    yellow: 'Degrading',
    red: 'Replace Soon',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 cursor-pointer transition-colors" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{battery.serial_number}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[health.status]}`}>
              {statusLabels[health.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {battery.capacity_mah ? `${battery.capacity_mah} mAh • ` : ''}{battery.flight_count} flights
          </p>
          <p className="text-xs text-gray-400">Degradation: {health.degradation_pct > 0 ? '+' : ''}{health.degradation_pct.toFixed(1)}% • Rate: {health.avg_discharge_rate.toFixed(2)}%/min</p>
        </div>
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}

interface BatteryListProps {
  onSelectBattery: (battery: Battery) => void
}

export function BatteryList({ onSelectBattery }: BatteryListProps) {
  const [batteries, setBatteries] = useState<Battery[]>([])
  const [healthMap, setHealthMap] = useState<Record<string, BatteryHealth>>({})
  const [loading, setLoading] = useState(true)

  const fetchBatteries = useCallback(async () => {
    try {
      const res = await fetch('/api/batteries')
      const data = await res.json()
      setBatteries(data)
      // Fetch health for each
      for (const b of data) {
        try {
          const h = await fetch(`/api/batteries/${b.id}/health`).then(r => r.ok ? r.json() : null)
          if (h) setHealthMap(prev => ({ ...prev, [b.id]: h }))
        } catch {}
      }
    } catch (e) {
      console.error('Failed to load batteries:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBatteries()
  }, [fetchBatteries])

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-500">Loading batteries...</p>
      </div>
    )
  }

  if (batteries.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 18a8 8 0 100-16 8 8 0 000 16zM12 6v9" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No batteries tracked yet</h3>
        <p className="mt-1 text-gray-500">Batteries are automatically created when you upload flights with DJI API key enabled</p>
        <p className="mt-2 text-sm text-gray-400">For v12 logs without serial numbers, you can manually assign batteries from the flight detail view</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {batteries.map(battery => {
        const health = healthMap[battery.id] || { status: 'green' as const, degradation_pct: 0, avg_discharge_rate: 0, flight_count: 0 }
        return (
          <BatteryListItem
            key={battery.id}
            battery={battery}
            health={health}
            onClick={() => onSelectBattery(battery)}
          />
        )
      })}
    </div>
  )
}

export type { Battery, BatteryHealth, FlightSummary }