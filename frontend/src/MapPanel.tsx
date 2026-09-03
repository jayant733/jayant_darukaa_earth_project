import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Project } from './data'

type Props = {
  projects: Project[]
  selected?: Project
  onSelect: (project: Project) => void
}

export function MapPanel({ projects, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

  useEffect(() => {
    if (!container.current || !token) return
    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: selected?.coordinates ?? [18, 8],
      zoom: selected ? 5.3 : 1.35,
      projection: 'mercator',
      attributionControl: false,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }))
    map.on('load', () => {
      projects.forEach((project) => {
        const el = document.createElement('button')
        el.className = `map-marker ${selected?.id === project.id ? 'is-selected' : ''}`
        el.setAttribute('aria-label', `Open ${project.name}`)
        el.onclick = () => onSelect(project)
        new mapboxgl.Marker({ element: el })
          .setLngLat(project.coordinates)
          .setPopup(
            new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
              `<strong>${project.name}</strong><span>${project.country} · ${project.area.toLocaleString()} ha</span>`,
            ),
          )
          .addTo(map)
      })
      if (selected) {
        map.addSource('site', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [selected.polygon] },
          },
        })
        map.addLayer({
          id: 'site-fill',
          type: 'fill',
          source: 'site',
          paint: { 'fill-color': '#b9ff67', 'fill-opacity': 0.25 },
        })
        map.addLayer({
          id: 'site-line',
          type: 'line',
          source: 'site',
          paint: { 'line-color': '#d5ff95', 'line-width': 2 },
        })
      }
    })
    return () => map.remove()
  }, [onSelect, projects, selected, token])

  if (!token) {
    if (selected) {
      const lngs = selected.polygon.map(([lng]) => lng)
      const lats = selected.polygon.map(([, lat]) => lat)
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)
      const points = selected.polygon
        .map(([lng, lat]) => {
          const x = ((lng - minLng) / (maxLng - minLng || 1)) * 100
          const y = (1 - (lat - minLat) / (maxLat - minLat || 1)) * 100
          return `${x},${y}`
        })
        .join(' ')
      return (
        <div className="map-fallback site-map" aria-label={`${selected.name} site map`}>
          <div className="map-grid" />
          <svg className="site-polygon" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points={points} />
          </svg>
          <div className="site-map-label">
            <span>{selected.country}</span>
            {selected.coordinates[1].toFixed(2)}°, {selected.coordinates[0].toFixed(2)}°
          </div>
        </div>
      )
    }
    return (
      <div className="map-fallback">
        <div className="map-grid" />
        <div className="continent c1" />
        <div className="continent c2" />
        <div className="continent c3" />
        {projects.map((project, index) => (
          <button
            className={`fallback-pin pin-${index + 1}`}
            key={project.id}
            onClick={() => onSelect(project)}
            aria-label={`Open ${project.name}`}
          >
            <span>{project.name}</span>
          </button>
        ))}
        <div className="map-token-note">
          <span>Mapbox preview mode</span>
          Add <code>VITE_MAPBOX_TOKEN</code> for satellite tiles
        </div>
      </div>
    )
  }
  return <div className="mapbox-container" ref={container} />
}
