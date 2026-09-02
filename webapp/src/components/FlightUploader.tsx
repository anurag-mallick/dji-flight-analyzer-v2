import React, { useCallback, useRef } from 'react'
import { parseDJILog, DJILogHeader, DJIFlightData, FlightStatistics } from '../lib/djiParser'

interface FlightRecord {
  id: string
  file: File
  data: DJIFlightData
  loadedAt: Date
}

interface FlightUploaderProps {
  onUpload: (files: FileList) => void
}

export function FlightUploader({ onUpload }: FlightUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => inputRef.current?.click()

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files)
    }
    e.target.value = ''
  }, [onUpload])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
    if (e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files)
    }
  }, [onUpload])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Flight Logs</h2>
      
      <div
        ref={inputRef}
        className="relative"
      >
        <input
          type="file"
          accept=".txt"
          multiple
          onChange={handleChange}
          className="sr-only"
          id="flight-upload"
        />
        
        <label
          htmlFor="flight-upload"
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors hover:border-blue-400 hover:bg-gray-50"
        >
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="mt-2 text-gray-600">
            <span className="font-medium text-blue-600">Drag & drop</span> or <span className="font-medium text-blue-600">click to select</span> .txt flight logs
          </p>
          <p className="mt-1 text-sm text-gray-500">Supports DJI Fly logs (v12, v13, v14 formats)</p>
        </label>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
        <h4 className="font-medium text-gray-700 mb-2">What gets parsed:</h4>
        <ul className="space-y-1 text-gray-600">
          <li>• Format detection (v12/v13/v14)</li>
          <li>• Aircraft type & serial number</li>
          <li>• Flight time, duration, location</li>
          <li>• Max altitude, distance, speed</li>
          <li>• Battery start/end %, captures</li>
        </ul>
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
          Full telemetry (GPS track, per-second data, battery curves) requires DJI API key + local backend
        </p>
      </div>
    </div>
  )
}