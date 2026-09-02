import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DJITelemetryPoint, FlightStatistics } from '../lib/djiParser'

interface BatteryViewProps {
  telemetry: DJITelemetryPoint[]
  statistics: FlightStatistics
}

export function BatteryView({ telemetry, statistics }: BatteryViewProps) {
  const hasData = telemetry.length > 0 && telemetry.some(p => p.batteryPercent > 0)

  const dischargeData = useMemo(() => {
    if (!hasData) return []
    return telemetry
      .filter(p => p.batteryPercent > 0)
      .map((p, i) => ({
        time: i,
        battery: p.batteryPercent,
        voltage: p.cellVoltage,
      }))
  }, [telemetry, hasData])

  const minBattery = dischargeData.length > 0 ? Math.min(...dischargeData.map(d => d.battery)) : 0
  const maxBattery = dischargeData.length > 0 ? Math.max(...dischargeData.map(d => d.battery)) : 0
  const batteryDrop = maxBattery - minBattery

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Battery Analysis</h3>

      {!hasData ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 18a8 8 0 100-16 8 8 0 000 16zM12 6v9" />
          </svg>
          <p className="mt-2">No battery telemetry</p>
          <p className="text-xs mt-1">Requires full telemetry decryption</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Discharge curve */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Discharge Curve</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dischargeData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[Math.max(0, minBattery - 5), maxBattery + 5]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="battery" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-4">
            <BatteryStat label="Start" value={`${maxBattery.toFixed(1)}%`} />
            <BatteryStat label="End" value={`${minBattery.toFixed(1)}%`} />
            <BatteryStat label="Consumed" value={`${batteryDrop.toFixed(1)}%`} />
            <BatteryStat label="Rate" value={`${statistics.dischargeRate.toFixed(2)}%/min`} />
            <BatteryStat label="Flight Time" value={`${(statistics.estimatedFlightTime || 0).toFixed(0)} min`} />
            <BatteryStat label="Avg Voltage" value={dischargeData.length > 0 ? `${(dischargeData.reduce((a, b) => a + b.voltage, 0) / dischargeData.length).toFixed(2)} V` : '—'} />
          </div>

          {/* Battery health indicator */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Battery Health</h4>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Estimated capacity retention</span>
                <span className="font-medium">{calculateHealth(batteryDrop, maxBattery)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${calculateHealthPercent(batteryDrop, maxBattery)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Based on single flight discharge. Track multiple flights with same battery for trend analysis.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BatteryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function calculateHealth(drop: number, start: number): string {
  if (start === 0) return 'Unknown'
  const retention = 100 - (drop / start * 100)
  if (retention > 95) return 'Excellent'
  if (retention > 90) return 'Good'
  if (retention > 80) return 'Fair'
  return 'Degraded'
}

function calculateHealthPercent(drop: number, start: number): number {
  if (start === 0) return 50
  const retention = 100 - (drop / start * 100)
  return Math.max(0, Math.min(100, retention))
}