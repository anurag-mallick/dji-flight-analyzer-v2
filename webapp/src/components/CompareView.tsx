import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatDuration } from '../lib/djiParser'

interface ComparePoint {
  norm_time: number
  time: number
  altitude: number
  speed: number
  battery: number
}

interface CompareFlight {
  id: string
  filename: string
  aircraft: string
  duration: number
  telemetry: ComparePoint[]
}

const SERIES_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b']
const BUCKET_COUNT = 51 // 0%, 2%, 4%, ... 100% of flight duration

function interpolateAt(points: ComparePoint[], key: 'altitude' | 'speed' | 'battery', normTime: number): number | null {
  if (points.length === 0) return null
  if (normTime <= points[0].norm_time) return points[0][key]
  if (normTime >= points[points.length - 1].norm_time) return points[points.length - 1][key]
  for (let i = 1; i < points.length; i++) {
    if (points[i].norm_time >= normTime) {
      const a = points[i - 1], b = points[i]
      const span = b.norm_time - a.norm_time
      const t = span > 0 ? (normTime - a.norm_time) / span : 0
      return a[key] + (b[key] - a[key]) * t
    }
  }
  return points[points.length - 1][key]
}

function buildMergedSeries(flights: CompareFlight[], key: 'altitude' | 'speed' | 'battery') {
  const rows: Record<string, number>[] = []
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const pct = (i / (BUCKET_COUNT - 1)) * 100
    const row: Record<string, number> = { pct }
    flights.forEach(f => {
      const v = interpolateAt(f.telemetry, key, pct / 100)
      if (v !== null) row[f.id] = Number(v.toFixed(2))
    })
    rows.push(row)
  }
  return rows
}

interface CompareViewProps {
  flightIds: string[]
  onClose: () => void
}

export function CompareView({ flightIds, onClose }: CompareViewProps) {
  const [flights, setFlights] = useState<CompareFlight[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/flights/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flightIds),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.detail || `Comparison failed (${res.status})`)
        }
        const data = await res.json()
        if (!cancelled) setFlights(data)
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load comparison')
      }
    }
    load()
    return () => { cancelled = true }
  }, [flightIds])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Flight Comparison</h2>
        <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">Close</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">{error}</div>
      )}

      {!flights && !error && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading comparison...</p>
        </div>
      )}

      {flights && flights.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flight</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aircraft</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {flights.map((f, i) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                      {f.filename}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{f.aircraft}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDuration(f.duration / 1000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CompareChart title="Altitude (m)" flights={flights} field="altitude" />
          <CompareChart title="Horizontal Speed (m/s)" flights={flights} field="speed" />
          <CompareChart title="Battery (%)" flights={flights} field="battery" />
        </>
      )}

      {flights && flights.length === 0 && (
        <p className="text-gray-500 text-sm">None of the selected flights have full telemetry to compare.</p>
      )}
    </div>
  )
}

function CompareChart({ title, flights, field }: { title: string; flights: CompareFlight[]; field: 'altitude' | 'speed' | 'battery' }) {
  const data = buildMergedSeries(flights, field)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title} vs. % of flight duration</h4>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="pct" tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip labelFormatter={v => `${Number(v).toFixed(0)}% of flight`} />
          <Legend />
          {flights.map((f, i) => (
            <Line
              key={f.id}
              type="monotone"
              dataKey={f.id}
              name={f.filename}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
