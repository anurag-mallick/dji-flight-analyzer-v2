import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DJITelemetryPoint, PointOfInterest } from '../lib/djiParser'

interface Map3DViewProps {
  validPoints: DJITelemetryPoint[]
  currentIndex: number
  pois: PointOfInterest[]
}

const METERS_PER_DEG_LAT = 111320
const TERRAIN_GRID_SIZE = 8 // 8x8 = 64 sample points, kept small for the free public elevation API
const TERRAIN_PADDING = 0.15 // extend the sampled area 15% beyond the flight's bounding box

const POI_3D_COLORS: Record<PointOfInterest['type'], number> = {
  home: 0x16a34a,
  photo: 0xeab308,
  video_start: 0xa855f7,
  rth: 0xdc2626,
}

interface TerrainGrid {
  lats: number[]
  lons: number[]
  elevations: number[][] // [latIndex][lonIndex]
  takeoffElevation: number
}

// Convert lat/lon/altitude into a local East-North-Up meter grid relative to
// the flight's takeoff point, with altitude mapped to the Y (up) axis.
function toLocalENU(points: DJITelemetryPoint[]): THREE.Vector3[] {
  const lat0 = points[0].latitude
  const baseAlt = Math.min(...points.map(p => p.altitude))
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180)
  return points.map(p => new THREE.Vector3(
    (p.longitude - points[0].longitude) * metersPerDegLon,
    p.altitude - baseAlt,
    -(p.latitude - lat0) * METERS_PER_DEG_LAT, // negate so north is "forward" (-Z) in the default camera view
  ))
}

function toLocalPoint(lat: number, lon: number, refLat: number, refLon: number): { x: number; z: number } {
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180)
  return { x: (lon - refLon) * metersPerDegLon, z: -(lat - refLat) * METERS_PER_DEG_LAT }
}

function buildTerrainGeometry(grid: TerrainGrid, refLat: number, refLon: number): THREE.BufferGeometry {
  const rows = grid.lats.length, cols = grid.lons.length
  const positions: number[] = []
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const { x, z } = toLocalPoint(grid.lats[i], grid.lons[j], refLat, refLon)
      positions.push(x, grid.elevations[i][j] - grid.takeoffElevation, z)
    }
  }
  const indices: number[] = []
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  return geom
}

// Queries the free public Open-Elevation API with a grid of points spanning the
// flight's bounding box, plus the exact takeoff point. This sends only bare
// lat/lon coordinates (no flight data) to a third-party service, and only when
// the user explicitly opts in via the checkbox in the 3D view.
async function fetchTerrainGrid(validPoints: DJITelemetryPoint[]): Promise<TerrainGrid> {
  const lats = validPoints.map(p => p.latitude)
  const lons = validPoints.map(p => p.longitude)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLon = Math.min(...lons), maxLon = Math.max(...lons)
  const latPad = (maxLat - minLat || 0.001) * TERRAIN_PADDING
  const lonPad = (maxLon - minLon || 0.001) * TERRAIN_PADDING
  const gridLats = Array.from({ length: TERRAIN_GRID_SIZE }, (_, i) =>
    (minLat - latPad) + ((maxLat + latPad) - (minLat - latPad)) * i / (TERRAIN_GRID_SIZE - 1))
  const gridLons = Array.from({ length: TERRAIN_GRID_SIZE }, (_, i) =>
    (minLon - lonPad) + ((maxLon + lonPad) - (minLon - lonPad)) * i / (TERRAIN_GRID_SIZE - 1))

  const locations = []
  for (const lat of gridLats) for (const lon of gridLons) locations.push({ latitude: lat, longitude: lon })
  locations.push({ latitude: validPoints[0].latitude, longitude: validPoints[0].longitude }) // takeoff point, appended last

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Elevation API returned ${res.status}`)
    const data = await res.json()
    const results: { elevation: number }[] = data.results
    if (!results || results.length !== locations.length) throw new Error('Unexpected elevation API response')

    const elevations: number[][] = []
    let k = 0
    for (let i = 0; i < TERRAIN_GRID_SIZE; i++) {
      const row: number[] = []
      for (let j = 0; j < TERRAIN_GRID_SIZE; j++) row.push(results[k++].elevation)
      elevations.push(row)
    }
    const takeoffElevation = results[k].elevation
    return { lats: gridLats, lons: gridLons, elevations, takeoffElevation }
  } finally {
    clearTimeout(timeout)
  }
}

export function Map3DView({ validPoints, currentIndex, pois }: Map3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<THREE.Mesh | null>(null)
  const positionsRef = useRef<THREE.Vector3[]>([])
  const [terrainEnabled, setTerrainEnabled] = useState(false)
  const [terrainStatus, setTerrainStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [terrainGrid, setTerrainGrid] = useState<TerrainGrid | null>(null)

  useEffect(() => {
    setTerrainGrid(null)
    setTerrainStatus('idle')
  }, [validPoints])

  useEffect(() => {
    if (!terrainEnabled || terrainGrid || validPoints.length === 0) return
    let cancelled = false
    setTerrainStatus('loading')
    fetchTerrainGrid(validPoints)
      .then(grid => { if (!cancelled) { setTerrainGrid(grid); setTerrainStatus('loaded') } })
      .catch(() => { if (!cancelled) setTerrainStatus('error') })
    return () => { cancelled = true }
  }, [terrainEnabled, terrainGrid, validPoints])

  useEffect(() => {
    const container = containerRef.current
    if (!container || validPoints.length === 0) return

    const positions = toLocalENU(validPoints)
    positionsRef.current = positions

    const bbox = new THREE.Box3().setFromPoints(positions)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const span = Math.max(size.x, size.z, 10)
    const center = new THREE.Vector3()
    bbox.getCenter(center)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf3f4f6)

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, span * 20)
    camera.position.set(center.x + span * 0.6, size.y + span * 0.5, center.z + span * 0.6)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(new THREE.Vector3(center.x, center.y, center.z))
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.update()

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const sun = new THREE.DirectionalLight(0xffffff, 0.8)
    sun.position.set(span, span, span)
    scene.add(sun)

    const disposables: { dispose: () => void }[] = []

    if (terrainGrid) {
      const geom = buildTerrainGeometry(terrainGrid, validPoints[0].latitude, validPoints[0].longitude)
      const mat = new THREE.MeshStandardMaterial({ color: 0xa3b18a, wireframe: false, side: THREE.DoubleSide })
      scene.add(new THREE.Mesh(geom, mat))
      disposables.push(geom, mat)
    } else {
      // Flat reference grid at takeoff altitude (0) — NOT real terrain elevation
      // data. Enable "Load real terrain elevation" to replace this with actual
      // elevation samples from a public elevation API.
      const grid = new THREE.GridHelper(span * 2, 20, 0x9ca3af, 0xd1d5db)
      grid.position.set(center.x, 0, center.z)
      scene.add(grid)
    }

    // Flight path as a tube so it reads clearly at any zoom level
    const curve = new THREE.CatmullRomCurve3(positions)
    const tubeRadius = Math.max(span * 0.003, 0.15)
    const tubeGeom = new THREE.TubeGeometry(curve, Math.max(positions.length, 2), tubeRadius, 8, false)
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
    scene.add(new THREE.Mesh(tubeGeom, tubeMat))
    disposables.push(tubeGeom, tubeMat)

    const markerSize = Math.max(span * 0.015, 0.4)
    const takeoff = new THREE.Mesh(new THREE.SphereGeometry(markerSize, 16, 16), new THREE.MeshStandardMaterial({ color: 0x22c55e }))
    takeoff.position.copy(positions[0])
    scene.add(takeoff)

    const landing = new THREE.Mesh(new THREE.SphereGeometry(markerSize, 16, 16), new THREE.MeshStandardMaterial({ color: 0xef4444 }))
    landing.position.copy(positions[positions.length - 1])
    scene.add(landing)

    const current = new THREE.Mesh(new THREE.SphereGeometry(markerSize * 1.2, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b }))
    current.position.copy(positions[Math.min(currentIndex, positions.length - 1)])
    scene.add(current)
    markerRef.current = current

    for (const poi of pois) {
      const { x, z } = toLocalPoint(poi.latitude, poi.longitude, validPoints[0].latitude, validPoints[0].longitude)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(markerSize * 0.8, 12, 12),
        new THREE.MeshStandardMaterial({ color: POI_3D_COLORS[poi.type] })
      )
      mesh.position.set(x, 0, z)
      scene.add(mesh)
    }

    let frameId: number
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      disposables.forEach(d => d.dispose())
      renderer.dispose()
      container.innerHTML = ''
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validPoints, terrainGrid, pois])

  // Cheap update: move the current-position marker without rebuilding the scene
  useEffect(() => {
    const positions = positionsRef.current
    if (markerRef.current && positions.length > 0) {
      markerRef.current.position.copy(positions[Math.min(currentIndex, positions.length - 1)])
    }
  }, [currentIndex])

  if (validPoints.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <h3 className="mt-2 text-lg font-medium text-gray-900">No GPS data</h3>
        <p className="mt-1 text-gray-500">Full telemetry requires DJI API key + local backend</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Flight Path (3D)</h3>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={terrainEnabled}
              onChange={e => setTerrainEnabled(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Load real terrain elevation (queries open-elevation.com with this flight's approximate coordinates)
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Drag to rotate · scroll to zoom ·{' '}
          {terrainStatus === 'loading' && 'loading terrain elevation...'}
          {terrainStatus === 'error' && 'terrain elevation lookup failed (public service may be rate-limited) — showing flat reference grid'}
          {terrainStatus === 'loaded' && 'ground surface reflects real elevation data from open-elevation.com'}
          {terrainStatus === 'idle' && 'ground grid is a flat spatial reference, not real terrain elevation'}
        </p>
      </div>
      <div ref={containerRef} className="h-96 cursor-grab active:cursor-grabbing" />
    </div>
  )
}
