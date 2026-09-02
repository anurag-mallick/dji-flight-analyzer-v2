import { DJITelemetryPoint, FlightStatistics } from './djiParser'

export type InsightLevel = 'warning' | 'info' | 'good'

export interface FlightInsight {
  level: InsightLevel
  title: string
  detail: string
}

function longestStretchBelow(values: number[], threshold: number): number {
  let longest = 0
  let current = 0
  for (const v of values) {
    if (v < threshold) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }
  return longest
}

/**
 * Rule-based "how could this flight have gone better" analysis, derived
 * entirely from telemetry already computed locally. No ML, no external
 * service, no data leaves the machine.
 */
export function generateFlightInsights(telemetry: DJITelemetryPoint[], stats: FlightStatistics): FlightInsight[] {
  if (telemetry.length === 0) return []

  const insights: FlightInsight[] = []

  const gpsStretch = longestStretchBelow(telemetry.map(p => p.gpsSats), 8)
  if (gpsStretch >= 5) {
    insights.push({
      level: 'warning',
      title: 'GPS signal was weak for part of the flight',
      detail: `Satellite count stayed below 8 for about ${gpsStretch}s. Fly in more open areas away from buildings/trees for a more reliable GPS lock.`,
    })
  }

  if (stats.minRcSignal > 0 && stats.minRcSignal < 40) {
    insights.push({
      level: 'warning',
      title: 'RC signal dropped low at times',
      detail: `Signal fell to ${stats.minRcSignal.toFixed(0)}%. Consider staying closer to the controller or checking for interference near the flight area.`,
    })
  }

  if (stats.minBattery > 0 && stats.minBattery < 20) {
    insights.push({
      level: 'warning',
      title: 'Landed with low battery margin',
      detail: `Battery ended at ${stats.minBattery.toFixed(0)}%. Landing above 20% preserves battery lifespan and leaves a safety margin for an unplanned extra minute of flight.`,
    })
  } else if (stats.minBattery > 0) {
    insights.push({
      level: 'good',
      title: 'Healthy landing battery margin',
      detail: `Landed at ${stats.minBattery.toFixed(0)}%, a safe margin above the 20% threshold recommended for battery longevity.`,
    })
  }

  const maxClimb = stats.maxVerticalSpeed
  const maxDescent = Math.abs(stats.minVerticalSpeed)
  if (Math.max(maxClimb, maxDescent) > 6) {
    insights.push({
      level: 'info',
      title: 'Some abrupt altitude changes',
      detail: `Vertical speed reached ${Math.max(maxClimb, maxDescent).toFixed(1)} m/s. Smoother, gradual climbs/descents reduce battery draw and improve footage stability.`,
    })
  }

  if (stats.maxTemperature > 40) {
    insights.push({
      level: 'warning',
      title: 'High operating temperature',
      detail: `Recorded up to ${stats.maxTemperature.toFixed(0)}°C. Prolonged heat exposure accelerates battery wear — avoid extended ground time in direct sun before takeoff.`,
    })
  }
  if (stats.minTemperature > 0 && stats.minTemperature < 5) {
    insights.push({
      level: 'info',
      title: 'Cold-weather flight',
      detail: `Minimum recorded temperature was ${stats.minTemperature.toFixed(0)}°C. Cold reduces usable battery capacity — a longer pre-flight hover lets the battery warm up before demanding maneuvers.`,
    })
  }

  if (stats.dischargeRate > 0 && stats.estimatedFlightTime > 0 && stats.estimatedFlightTime < 3) {
    insights.push({
      level: 'info',
      title: 'Discharge rate was high near the end',
      detail: `At the closing discharge rate (${stats.dischargeRate.toFixed(2)}%/min), remaining flight time was estimated at only ${stats.estimatedFlightTime.toFixed(1)} min — aggressive maneuvers late in a flight consume disproportionate battery.`,
    })
  }

  if (insights.length === 0 || insights.every(i => i.level === 'good')) {
    insights.push({
      level: 'good',
      title: 'Clean flight overall',
      detail: 'No signal, battery, or abrupt-maneuver risk factors were detected in this log.',
    })
  }

  return insights
}
