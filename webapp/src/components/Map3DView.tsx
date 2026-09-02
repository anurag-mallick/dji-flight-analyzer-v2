import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DJITelemetryPoint } from '../lib/djiParser'

interface Map3DViewProps {
  validPoints: DJITelemetryPoint[]
  currentIndex: number
}

const METERS_PER_DEG_LAT = 111320

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

export function Map3DView({ validPoints, currentIndex }: Map3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<THREE.Mesh | null>(null)
  const positionsRef = useRef<THREE.Vector3[]>([])

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

    // Flat reference grid at takeoff altitude (0) — this is NOT real terrain
    // elevation data, the DJI log has none; it is only a spatial reference plane.
    const grid = new THREE.GridHelper(span * 2, 20, 0x9ca3af, 0xd1d5db)
    grid.position.set(center.x, 0, center.z)
    scene.add(grid)

    // Flight path as a tube so it reads clearly at any zoom level
    const curve = new THREE.CatmullRomCurve3(positions)
    const tubeRadius = Math.max(span * 0.003, 0.15)
    const tubeGeom = new THREE.TubeGeometry(curve, Math.max(positions.length, 2), tubeRadius, 8, false)
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 })
    scene.add(new THREE.Mesh(tubeGeom, tubeMat))

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
      tubeGeom.dispose()
      tubeMat.dispose()
      renderer.dispose()
      container.innerHTML = ''
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validPoints])

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
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Flight Path (3D)</h3>
        <span className="text-xs text-gray-500">Drag to rotate · scroll to zoom · ground grid is a flat spatial reference, not real terrain elevation</span>
      </div>
      <div ref={containerRef} className="h-96 cursor-grab active:cursor-grabbing" />
    </div>
  )
}
