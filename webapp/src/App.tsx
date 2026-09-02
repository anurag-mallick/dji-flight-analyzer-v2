import React, { useState, useCallback } from 'react'
import { FlightUploader } from './components/FlightUploader'
import { FlightList } from './components/FlightList'
import { FlightDetail } from './components/FlightDetail'
import { StatsPanel } from './components/StatsPanel'
import { MapView } from './components/MapView'
import { ChartsPanel } from './components/ChartsPanel'
import { BatteryView } from './components/BatteryView'
import { ExportPanel } from './components/ExportPanel'
import { parseDJILog, DJIFlightData, DJILogHeader } from './lib/djiParser'

type ViewMode = 'list' | 'detail'

interface FlightRecord {
  id: string
  file: File
  data: DJIFlightData
  loadedAt: Date
}

function App() {
  const [flights, setFlights] = useState<FlightRecord[]>([])
  const [selectedFlight, setSelectedFlight] = useState<FlightRecord | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [apiKey, setApiKey] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState(false)

  const handleFilesUpload = useCallback(async (files: FileList) => {
    const newRecords: FlightRecord[] = []
    for (const file of Array.from(files)) {
      const result = await parseDJILog(file, apiKey || undefined)
      newRecords.push({
        id: `${file.name}-${Date.now()}`,
        file,
        data: {
          header: result.header,
          telemetry: result.telemetry,
          statistics: result.statistics,
        },
        loadedAt: new Date(),
      })
    }
    setFlights(prev => [...prev, ...newRecords])
  }, [apiKey])

  const handleSelectFlight = (flight: FlightRecord) => {
    setSelectedFlight(flight)
    setViewMode('detail')
  }

  const handleBackToList = () => {
    setViewMode('list')
    setSelectedFlight(null)
  }

  const handleRemoveFlight = (id: string) => {
    setFlights(prev => prev.filter(f => f.id !== id))
    if (selectedFlight?.id === id) {
      setSelectedFlight(null)
      setViewMode('list')
    }
  }

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
        {viewMode === 'list' ? (
          <FlightList
            flights={flights}
            onSelect={handleSelectFlight}
            onRemove={handleRemoveFlight}
            onUpload={handleFilesUpload}
          />
        ) : (
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

            <FlightDetail flight={selectedFlight!} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MapView telemetry={selectedFlight!.data.telemetry} />
                <ChartsPanel telemetry={selectedFlight!.data.telemetry} />
              </div>
              <div className="space-y-6">
                <StatsPanel header={selectedFlight!.data.header} statistics={selectedFlight!.data.statistics} />
                <BatteryView telemetry={selectedFlight!.data.telemetry} statistics={selectedFlight!.data.statistics} />
                <ExportPanel flightData={selectedFlight!.data} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App