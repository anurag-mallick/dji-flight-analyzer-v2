import React from 'react'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Bar
} from 'recharts'
import { DJITelemetryPoint } from '../lib/djiParser'

interface ChartDataPoint {
  time: number
  altitude: number
  speed: number
  verticalSpeed: number
  battery: number
  voltage: number
  gpsSats: number
  rcSignal: number
  temperature: number
  pitch: number
  roll: number
  yaw: number
}

function formatData(telemetry: DJITelemetryPoint[]): ChartDataPoint[] {
  return telemetry.map((p, i) => ({
    time: i,
    altitude: p.altitude,
    speed: p.horizontalSpeed,
    verticalSpeed: p.verticalSpeed,
    battery: p.batteryPercent,
    voltage: p.cellVoltage,
    gpsSats: p.gpsSats,
    rcSignal: p.rcSignalStrength,
    temperature: p.temperature,
    pitch: p.gimbalPitch,
    roll: p.gimbalRoll,
    yaw: p.gimbalYaw,
  }))
}

const CHART_COLORS = {
  altitude: '#3b82f6',
  speed: '#10b981',
  verticalSpeed: '#f59e0b',
  battery: '#ef4444',
  voltage: '#8b5cf6',
  gpsSats: '#ec4899',
  rcSignal: '#06b6d4',
  temperature: '#f97316',
  pitch: '#3b82f6',
  roll: '#10b981',
  yaw: '#f59e0b',
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
      <div className="h-48">{children}</div>
    </div>
  )
}

function AltitudeChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="Altitude">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.altitude} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.altitude} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
          <Area type="monotone" dataKey="altitude" fill="url(#altitudeGradient)" stroke={CHART_COLORS.altitude} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function SpeedChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="Speed (Horizontal)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="speed" stroke={CHART_COLORS.speed} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function VerticalSpeedChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="Vertical Speed">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Bar dataKey="verticalSpeed" fill="#f59e0b" radius={[2, 2, 0, 0]} maxBarSize={8} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function BatteryChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="Battery %">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.battery} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.battery} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Area type="monotone" dataKey="battery" fill="url(#batteryGradient)" stroke={CHART_COLORS.battery} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function VoltageChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="Cell Voltage (V)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="voltage" stroke={CHART_COLORS.voltage} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function GPSChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="GPS Satellites">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 20]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="gpsSats" stroke={CHART_COLORS.gpsSats} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function RCSignalChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="RC Signal %">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="rcSignal" stroke={CHART_COLORS.rcSignal} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function TemperatureChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="Temperature (°C)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="temperature" stroke={CHART_COLORS.temperature} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function AttitudeChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <ChartCard title="Gimbal Attitude (°)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="pitch" stroke={CHART_COLORS.pitch} strokeWidth={1.5} dot={false} name="Pitch" />
          <Line type="monotone" dataKey="roll" stroke={CHART_COLORS.roll} strokeWidth={1.5} dot={false} name="Roll" />
          <Line type="monotone" dataKey="yaw" stroke={CHART_COLORS.yaw} strokeWidth={1.5} dot={false} name="Yaw" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ChartsPanel({ telemetry }: { telemetry: DJITelemetryPoint[] }) {
  if (telemetry.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center col-span-full">
        <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No telemetry data</h3>
        <p className="mt-1 text-gray-500">Charts require full telemetry (DJI API key + local backend)</p>
      </div>
    )
  }

  const data = formatData(telemetry)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AltitudeChart data={data} />
        <SpeedChart data={data} />
        <VerticalSpeedChart data={data} />
        <BatteryChart data={data} />
        <VoltageChart data={data} />
        <GPSChart data={data} />
        <RCSignalChart data={data} />
        <TemperatureChart data={data} />
        <AttitudeChart data={data} />
      </div>
    </div>
  )
}