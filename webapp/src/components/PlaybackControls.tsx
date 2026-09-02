import React, { useEffect, useRef, useState } from 'react'
import { DJITelemetryPoint } from '../lib/djiParser'

interface PlaybackControlsProps {
  points: DJITelemetryPoint[]
  currentIndex: number
  onSeek: (index: number) => void
}

const SPEEDS = [0.5, 1, 2, 4, 8]

// "Flight simulation" here means an animated replay of the recorded telemetry —
// the DJI log contains no control-input or physics data, so this drives the
// existing position/altitude/speed/battery readout forward automatically
// rather than simulating flight dynamics.
export function PlaybackControls({ points, currentIndex, onSeek }: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const indexRef = useRef(currentIndex)
  const onSeekRef = useRef(onSeek)
  indexRef.current = currentIndex
  onSeekRef.current = onSeek

  useEffect(() => {
    if (!isPlaying || points.length === 0) return
    const tickMs = Math.max(1000 / speed / 10, 20) // advances ~10 samples/sec of playback time, scaled by speed
    const interval = setInterval(() => {
      const next = indexRef.current + 1
      if (next >= points.length) {
        setIsPlaying(false)
        return
      }
      onSeekRef.current(next)
    }, tickMs)
    return () => clearInterval(interval)
  }, [isPlaying, speed, points.length])

  if (points.length === 0) return null

  const current = points[currentIndex]
  const progress = points.length > 1 ? (currentIndex / (points.length - 1)) * 100 : 0

  const togglePlay = () => {
    if (!isPlaying && currentIndex >= points.length - 1) onSeek(0)
    setIsPlaying(p => !p)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => { setIsPlaying(false); onSeek(0) }} className="p-2 text-gray-500 hover:text-gray-700" title="Start">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6V18z"/></svg>
        </button>
        <button onClick={() => { setIsPlaying(false); onSeek(Math.max(0, currentIndex - 1)) }} className="p-2 text-gray-500 hover:text-gray-700" title="Step back">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18l-6-6 6-6v12zm8 0l-6-6 6-6v12z"/></svg>
        </button>
        <button onClick={togglePlay} className="p-2 text-blue-600 hover:text-blue-800" title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <button onClick={() => { setIsPlaying(false); onSeek(Math.min(points.length - 1, currentIndex + 1)) }} className="p-2 text-gray-500 hover:text-gray-700" title="Step forward">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 18l6-6-6-6v12zm-8 0l6-6-6-6v12z"/></svg>
        </button>
        <button onClick={() => { setIsPlaying(false); onSeek(points.length - 1) }} className="p-2 text-gray-500 hover:text-gray-700" title="End">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6v12l8.5-6L12 6z"/></svg>
        </button>
        <select
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          className="text-xs border border-gray-300 rounded px-1.5 py-1"
          title="Playback speed"
        >
          {SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
        </select>
        <div className="flex-1 h-2 bg-gray-200 rounded-full cursor-pointer relative" onClick={(e) => {
          setIsPlaying(false)
          const rect = e.currentTarget.getBoundingClientRect()
          const percent = (e.clientX - rect.left) / rect.width
          onSeek(Math.round(percent * (points.length - 1)))
        }}>
          <div className="h-full bg-blue-600 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-md" style={{ left: `${progress}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
        <div>Alt: {current?.altitude?.toFixed(1) ?? '—'} m</div>
        <div>Speed: {current?.horizontalSpeed?.toFixed(1) ?? '—'} m/s</div>
        <div>Bat: {current?.batteryPercent?.toFixed(0) ?? '—'}%</div>
        <div>Sats: {current?.gpsSats ?? '—'}</div>
      </div>
    </div>
  )
}
