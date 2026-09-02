import React, { useState, useCallback, useEffect } from 'react'
import { FlightUploader } from './components/FlightUploader'
import { FlightList } from './components/FlightList'
import { FlightDetail } from './components/FlightDetail'
import { StatsPanel } from './components/StatsPanel'
import { MapView } from './components/MapView'
import { ChartsPanel } from './components/ChartsPanel'
import { BatteryView } from './components/BatteryView'
import { ExportPanel } from './components/ExportPanel'
import { BatteryList, BatteryDetail, Battery } from './components/BatteryViews'
import { parseDJILog, DJIFlightData, DJILogHeader } from './lib/djiParser'

type ViewMode = 'flights' | 'flight-detail' | 'batteries' | 'battery-detail'

interface FlightRecord {
  id: string
  file: File
  data: DJIFlightData
  loadedAt: Date
}

interface BackendFlight {
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

function App() {
  const [flights, setFlights] = useState<FlightRecord[]>([])
  const [backendFlights, setBackendFlights] = useState<BackendFlight[]>([])
  const [selectedFlight, setSelectedFlight] = useState<FlightRecord | null>(null)
  const [selectedBackendFlight, setSelectedBackendFlight] = useState<BackendFlight | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('flights')
  const [selectedBattery, setSelectedBattery] = useState<Battery | null>(null)
  const [apiKey, setApiKey] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState(false)

  // Load backend flights on startup
  useEffect(() => {
    fetch('/api/flights')
      .then(r => r.json())
      .then(data => setBackendFlights(data))
      .catch(() => {})
  }, [])

  const handleFilesUpload = useCallback(async (files: FileList) => {
    const newRecords: FlightRecord[] = []
    for (const file of Array.from(files)) {
      const result = await parseDJILog(file, apiKey || undefined)
      const flightId = `${file.name}-${Date.now()}`
      const newRecord: FlightRecord = {
        id: flightId,
        file,
        data: {
          header: result.header,
          telemetry: result.telemetry,
          statistics: result.statistics,
        },
        loadedAt: new Date(),
      }
      newRecords.push(newRecord)
      setFlights(prev => [...prev, newRecord])

      // Also upload to backend for persistence
      const formData = new FormData()
      formData.append('file', file)
      fetch('/api/upload', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(backendFlight => {
          if (backendFlight.id) {
            setBackendFlights(prev => [backendFlight, ...prev])
          }
        })
        .catch(() => {})
    }
  }, [apiKey])

  const handleSelectFlight = (flight: FlightRecord) => {
    setSelectedFlight(flight)
    setViewMode('flight-detail')
  }

  const handleSelectBackendFlight = (flight: BackendFlight) => {
    setSelectedBackendFlight(flight)
    setViewMode('flight-detail')
  }

  const handleBackToList = () => {
    setViewMode('flights')
    setSelectedFlight(null)
    setSelectedBackendFlight(null)
  }

  const handleRemoveFlight = (id: string) => {
    setFlights(prev => prev.filter(f => f.id !== id))
    setBackendFlights(prev => prev.filter(f => f.id !== id))
    if (selectedFlight?.id === id || selectedBackendFlight?.id === id) {
      setSelectedFlight(null)
      setSelectedBackendFlight(null)
      setViewMode('flights')
    }
  }

  const handleBatteryClick = (battery: Battery) => {
    setSelectedBattery(battery)
    setViewMode('battery-detail')
  }

  const handleBackToBatteries = () => {
    setViewMode('batteries')
    setSelectedBattery(null)
  }

  const getCurrentFlight = () => selectedFlight || selectedBackendFlight

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 2 16.828 5.236 17.657 6.072a8.187 8.187 0 010 12.585z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">DJI Flight Analyzer</h1>
                <p className="text-xs text-gray-500">Local-first • Privacy-respecting • Free alternative to Airdata</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mr-4">
              <button
                onClick={() => setViewMode('flights')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'flights' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Flights
              </button>
              <button
                onClick={() => { setViewMode('batteries'); setSelectedBattery(null); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'batteries' || viewMode === 'battery-detail' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Batteries
              </button>
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showApiKey ? 'Hide' : 'Set'} DJI API Key
              </button>
              {showApiKey && (
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Enter DJI API key (optional)"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Flights List View */}
        {viewMode === 'flights' && (
          <FlightList
            flights={[
              ...flights.map(f => ({ ...f, isLocal: true })),
              ...backendFlights.map(f => ({ ...f, isLocal: false }))
            ]}
            onSelect={f => f.isLocal ? handleSelectFlight(f) : handleSelectBackendFlight(f)}
            onRemove={handleRemoveFlight}
            onUpload={handleFilesUpload}
          />
        )}

        {/* Battery List View */}
        {viewMode === 'batteries' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Battery Tracking</h2>
            </div>
            <BatteryList onSelectBattery={handleBatteryClick} />
          </div>
        )}

        {/* Battery Detail View */}
        {viewMode === 'battery-detail' && selectedBattery && (
          <div className="space-y-6">
            <button
              onClick={handleBackToBatteries}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to batteries
            </button>
            <BatteryDetail
              battery={selectedBattery}
              health={{ status: 'green', degradation_pct: 0, avg_discharge_rate: 0, discharge_rates: [], avg_voltage_sag: 0, early_avg_rate: 0, recent_avg_rate: 0, flight_count: 0 }}
              flights={[]}
              onClose={handleBackToBatteries}
            />
          </div>
        )}

        {/* Flight Detail View */}
        {(viewMode === 'flight-detail') && getCurrentFlight() && (
          <div className="space-y-6">
            <button
              onClick={handleBackToList}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to flights
            </button>

            <FlightDetail flight={getCurrentFlight()!} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MapView telemetry={getCurrentFlight()!.data.telemetry} />
                <ChartsPanel telemetry={getCurrentFlight()!.data.telemetry} />
              </div>
              <div className="space-y-6">
                <StatsPanel header={getCurrentFlight()!.data.header} statistics={getCurrentFlight()!.data.statistics} />
                <BatteryView telemetry={getCurrentFlight()!.data.telemetry} statistics={getCurrentFlight()!.data.statistics} />
                <ExportPanel flightData={getCurrentFlight()!.data} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App