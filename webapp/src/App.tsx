import React, { useCallback, useEffect, useState } from 'react'
import { FlightList, PendingUpload } from './components/FlightList'
import { FlightDetail } from './components/FlightDetail'
import { StatsPanel } from './components/StatsPanel'
import { FlightMapSection } from './components/FlightMapSection'
import { ChartsPanel } from './components/ChartsPanel'
import { BatteryView } from './components/BatteryView'
import { ExportPanel } from './components/ExportPanel'
import { FlightInsights } from './components/FlightInsights'
import { BatteryList, BatteryDetail, Battery } from './components/BatteryViews'
import { AircraftView } from './components/AircraftView'
import { CompareView } from './components/CompareView'
import { BackendFlightSummary, BackendFlightDetail, DJIFlightData, backendDetailToFlightData } from './lib/djiParser'

type ViewMode = 'flights' | 'flight-detail' | 'batteries' | 'battery-detail' | 'aircraft' | 'compare'

function App() {
  const [flights, setFlights] = useState<BackendFlightSummary[]>([])
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('flights')
  const [selectedFlight, setSelectedFlight] = useState<BackendFlightSummary | null>(null)
  const [selectedFlightData, setSelectedFlightData] = useState<DJIFlightData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [selectedBattery, setSelectedBattery] = useState<Battery | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const fetchFlights = useCallback(async (query?: string) => {
    const url = query ? `/api/flights/search?free_text=${encodeURIComponent(query)}` : '/api/flights'
    try {
      const res = await fetch(url)
      if (res.ok) setFlights(await res.json())
    } catch {
      // local backend not running — leave the current list as-is
    }
  }, [])

  useEffect(() => { fetchFlights() }, [fetchFlights])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    fetchFlights(query || undefined)
  }, [fetchFlights])

  const handleFilesUpload = useCallback(async (files: FileList) => {
    const items = Array.from(files).map(file => ({
      file,
      tempId: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }))
    setPending(prev => [...prev, ...items.map(i => ({ tempId: i.tempId, filename: i.file.name, status: 'uploading' as const }))])

    for (const { file, tempId } of items) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Upload failed')
        setPending(prev => prev.filter(p => p.tempId !== tempId))
        await fetchFlights(searchQuery || undefined)
      } catch {
        setPending(prev => prev.map(p => p.tempId === tempId
          ? { ...p, status: 'error' as const, error: 'Upload failed — is the local backend running on :8000?' }
          : p))
      }
    }
  }, [fetchFlights, searchQuery])

  const handleSelectFlight = useCallback(async (flight: BackendFlightSummary) => {
    setSelectedFlight(flight)
    setViewMode('flight-detail')
    setSelectedFlightData(null)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/flights/${flight.id}`)
      if (res.ok) {
        const detail: BackendFlightDetail = await res.json()
        setSelectedFlightData(backendDetailToFlightData(detail))
      }
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const handleBackToList = () => {
    setViewMode('flights')
    setSelectedFlight(null)
    setSelectedFlightData(null)
  }

  const handleRemoveFlight = useCallback(async (id: string) => {
    try {
      await fetch(`/api/flights/${id}`, { method: 'DELETE' })
    } finally {
      setFlights(prev => prev.filter(f => f.id !== id))
      setCompareIds(prev => prev.filter(fid => fid !== id))
      if (selectedFlight?.id === id) handleBackToList()
    }
  }, [selectedFlight])

  const handleTagsUpdated = (flightId: string, tags: string) => {
    setFlights(prev => prev.map(f => f.id === flightId ? { ...f, tags } : f))
    setSelectedFlight(prev => prev && prev.id === flightId ? { ...prev, tags } : prev)
  }

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(fid => fid !== id)
      if (prev.length >= 4) return prev // backend caps comparison at 4 flights
      return [...prev, id]
    })
  }

  const handleBatteryClick = (battery: Battery) => {
    setSelectedBattery(battery)
    setViewMode('battery-detail')
  }

  const handleBackToBatteries = () => {
    setViewMode('batteries')
    setSelectedBattery(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
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

            <nav className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['flights', 'batteries', 'aircraft'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setViewMode(tab); setSelectedBattery(null) }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                    viewMode === tab || (tab === 'batteries' && viewMode === 'battery-detail')
                      ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
              <button
                onClick={() => compareIds.length >= 2 && setViewMode('compare')}
                disabled={compareIds.length < 2}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'compare' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                } ${compareIds.length < 2 ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={compareIds.length < 2 ? 'Select 2-4 flights in the Flights tab to compare' : ''}
              >
                Compare{compareIds.length > 0 ? ` (${compareIds.length})` : ''}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === 'flights' && (
          <FlightList
            flights={flights}
            pending={pending}
            onSelect={handleSelectFlight}
            onRemove={handleRemoveFlight}
            onUpload={handleFilesUpload}
            onSearch={handleSearch}
            selectedForCompare={compareIds}
            onToggleCompare={toggleCompare}
          />
        )}

        {viewMode === 'aircraft' && <AircraftView />}

        {viewMode === 'compare' && (
          <CompareView flightIds={compareIds} onClose={() => setViewMode('flights')} />
        )}

        {viewMode === 'batteries' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Battery Tracking</h2>
            </div>
            <BatteryList onSelectBattery={handleBatteryClick} />
          </div>
        )}

        {viewMode === 'battery-detail' && selectedBattery && (
          <BatteryDetail battery={selectedBattery} onClose={handleBackToBatteries} />
        )}

        {viewMode === 'flight-detail' && selectedFlight && (
          <div className="space-y-6">
            <button onClick={handleBackToList} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to flights
            </button>

            <FlightDetail header={selectedFlight} onTagsUpdated={handleTagsUpdated} />

            {loadingDetail ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading telemetry...</p>
              </div>
            ) : selectedFlightData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <FlightMapSection telemetry={selectedFlightData.telemetry} pois={selectedFlightData.pois} />
                  <ChartsPanel telemetry={selectedFlightData.telemetry} />
                </div>
                <div className="space-y-6">
                  <StatsPanel header={selectedFlightData.header} statistics={selectedFlightData.statistics} />
                  <FlightInsights telemetry={selectedFlightData.telemetry} statistics={selectedFlightData.statistics} />
                  <BatteryView telemetry={selectedFlightData.telemetry} statistics={selectedFlightData.statistics} />
                  <ExportPanel flightData={selectedFlightData} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
