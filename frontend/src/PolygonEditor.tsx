import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Edit3, MapPin, RotateCcw, Trash2 } from 'lucide-react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import type { PolygonGeometry } from './api'

type Props = {
  value?: PolygonGeometry
  onChange: (geometry?: PolygonGeometry) => void
  label?: string
}

function validPolygon(value: unknown): value is PolygonGeometry {
  if (!value || typeof value !== 'object') return false
  const candidate = value as PolygonGeometry
  const ring = candidate.coordinates?.[0]
  return (
    candidate.type === 'Polygon' &&
    Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every((coordinate) => Number.isFinite(coordinate)),
    ) &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  )
}

function feature(geometry: PolygonGeometry) {
  return { type: 'Feature' as const, properties: {}, geometry }
}

export function PolygonEditor({ value, onChange, label = 'Site boundary' }: Props) {
  const id = useId()
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)
  const initialValue = useRef(value)
  const onChangeRef = useRef(onChange)
  const token = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.trim()
  const tokenValid = Boolean(token?.startsWith('pk.'))
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>(
    tokenValid ? 'loading' : 'error',
  )
  const [text, setText] = useState(() =>
    JSON.stringify(value ?? { type: 'Polygon', coordinates: [] }, null, 2),
  )
  const [textError, setTextError] = useState('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!container.current || !tokenValid || !token) return
    mapboxgl.accessToken = token
    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        container: container.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [0, 15],
        zoom: 1.25,
        attributionControl: false,
      })
    } catch {
      queueMicrotask(() => setMapState('error'))
      return
    }
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: initialValue.current ? 'simple_select' : 'draw_polygon',
    })
    mapRef.current = map
    drawRef.current = draw
    const failed = () => setMapState('error')
    const sync = () => {
      const polygon = draw.getAll().features.find((item) => item.geometry.type === 'Polygon')
      const geometry = polygon?.geometry as PolygonGeometry | undefined
      setText(JSON.stringify(geometry ?? { type: 'Polygon', coordinates: [] }, null, 2))
      onChangeRef.current(geometry)
    }
    map.once('error', failed)
    map.on('load', () => {
      map.addControl(draw, 'top-left')
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      if (initialValue.current) {
        draw.add(feature(initialValue.current))
        const bounds = new mapboxgl.LngLatBounds()
        initialValue.current.coordinates[0].forEach((point) => bounds.extend(point))
        map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 })
      }
      map.on('draw.create', sync)
      map.on('draw.update', sync)
      map.on('draw.delete', sync)
      setMapState('ready')
    })
    return () => {
      map.off('error', failed)
      map.off('draw.create', sync)
      map.off('draw.update', sync)
      map.off('draw.delete', sync)
      map.remove()
      mapRef.current = null
      drawRef.current = null
    }
  }, [token, tokenValid])

  const message = useMemo(() => {
    if (!tokenValid) return 'Add a valid VITE_MAPBOX_TOKEN to draw on the map.'
    return 'Map tiles could not load. Enter exact GeoJSON coordinates below.'
  }, [tokenValid])

  function clear() {
    drawRef.current?.deleteAll()
    setText(JSON.stringify({ type: 'Polygon', coordinates: [] }, null, 2))
    onChange(undefined)
  }

  function reset() {
    drawRef.current?.deleteAll()
    if (initialValue.current && drawRef.current) drawRef.current.add(feature(initialValue.current))
    setText(JSON.stringify(initialValue.current ?? { type: 'Polygon', coordinates: [] }, null, 2))
    onChange(initialValue.current)
  }

  function startDrawing() {
    drawRef.current?.deleteAll()
    drawRef.current?.changeMode('draw_polygon')
    setText(JSON.stringify({ type: 'Polygon', coordinates: [] }, null, 2))
    onChange(undefined)
  }

  function applyText() {
    try {
      const parsed: unknown = JSON.parse(text)
      if (!validPolygon(parsed)) {
        throw new Error('Use a closed GeoJSON Polygon ring with at least four coordinate pairs.')
      }
      setTextError('')
      onChange(parsed)
      const draw = drawRef.current
      if (draw) {
        draw.deleteAll()
        draw.add(feature(parsed))
        draw.changeMode('simple_select')
        const bounds = new mapboxgl.LngLatBounds()
        parsed.coordinates[0].forEach((point) => bounds.extend(point))
        mapRef.current?.fitBounds(bounds, { padding: 48, maxZoom: 14 })
      }
    } catch (error) {
      setTextError(error instanceof Error ? error.message : 'Enter valid GeoJSON.')
    }
  }

  return (
    <div className="polygon-editor">
      <div className="polygon-toolbar" aria-label={`${label} drawing tools`}>
        <button
          type="button"
          className="secondary"
          onClick={startDrawing}
          disabled={mapState !== 'ready'}
        >
          <MapPin size={15} /> Draw polygon
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            drawRef.current?.changeMode('direct_select', {
              featureId: String(drawRef.current?.getAll().features[0]?.id ?? ''),
            })
          }
          disabled={mapState !== 'ready' || !value}
        >
          <Edit3 size={15} /> Edit vertices
        </button>
        <button type="button" className="secondary" onClick={reset}>
          <RotateCcw size={15} /> Reset
        </button>
        <button type="button" className="secondary danger" onClick={clear} disabled={!value}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
      <div className="polygon-map" ref={container} aria-label={`${label} map editor`}>
        {mapState === 'loading' && (
          <div className="map-loading" role="status">
            <span />
            Loading drawing map…
          </div>
        )}
        {mapState === 'error' && (
          <div className="map-editor-error">
            <MapPin />
            <strong>Map unavailable</strong>
            <span>{message}</span>
          </div>
        )}
      </div>
      <details className="coordinate-fallback" open={mapState === 'error'}>
        <summary>Enter exact GeoJSON coordinates</summary>
        <label htmlFor={`${id}-coordinates`}>
          Polygon geometry
          <textarea
            id={`${id}-coordinates`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            aria-describedby={`${id}-coordinate-help`}
          />
        </label>
        <p id={`${id}-coordinate-help`}>
          Longitude comes first. The final coordinate must exactly match the first.
        </p>
        {textError && (
          <p className="form-error" role="alert">
            {textError}
          </p>
        )}
        <button type="button" className="secondary" onClick={applyText}>
          Apply coordinates
        </button>
      </details>
    </div>
  )
}
