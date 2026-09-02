import React from 'react'
import { DJITelemetryPoint, FlightStatistics } from '../lib/djiParser'
import { generateFlightInsights, InsightLevel } from '../lib/flightInsights'

const LEVEL_STYLES: Record<InsightLevel, string> = {
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  good: 'bg-green-50 border-green-200 text-green-900',
}

const LEVEL_ICONS: Record<InsightLevel, string> = {
  warning: '⚠',
  info: 'ℹ',
  good: '✓',
}

interface FlightInsightsProps {
  telemetry: DJITelemetryPoint[]
  statistics: FlightStatistics
}

export function FlightInsights({ telemetry, statistics }: FlightInsightsProps) {
  if (telemetry.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Flight Insights</h3>
        <p className="text-sm text-gray-500">Requires full telemetry to analyze.</p>
      </div>
    )
  }

  const insights = generateFlightInsights(telemetry, statistics)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Flight Insights</h3>
      <p className="text-xs text-gray-500 mb-4">
        Rule-based observations derived from this flight's own telemetry — computed locally, no external service involved.
      </p>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className={`border rounded-lg p-3 ${LEVEL_STYLES[insight.level]}`}>
            <p className="text-sm font-medium flex items-center gap-2">
              <span>{LEVEL_ICONS[insight.level]}</span>
              {insight.title}
            </p>
            <p className="text-xs mt-1 opacity-90">{insight.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
