import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'
import type { SeriesPoint } from './api'

function chartLib() {
  const module = Highcharts as unknown as { default?: typeof Highcharts }
  return module.default ?? Highcharts
}

function ChartFrame({ options }: { options: Highcharts.Options }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = host.current
    if (!node) return
    const chart = chartLib().chart(node, options)
    return () => {
      chart.destroy()
    }
  }, [options])

  return <div ref={host} />
}

function sharedOptions(categories: string[]): Highcharts.Options {
  return {
    chart: { backgroundColor: 'transparent', height: 245, spacing: [12, 4, 8, 0] },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      categories,
      lineColor: '#d9d9d1',
      tickColor: '#d9d9d1',
      labels: { style: { color: '#75766e', fontSize: '11px' } },
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: '#e5e5dd',
      labels: { style: { color: '#75766e', fontSize: '11px' } },
    },
    tooltip: {
      borderWidth: 0,
      backgroundColor: '#122019',
      style: { color: '#fff' },
      shadow: false,
    },
  }
}

export function AnalyticsCharts({ id, series }: { id: string; series: SeriesPoint[] }) {
  if (series.length === 0) {
    return (
      <div className="charts-grid">
        <section className="chart-card empty-chart">
          <span className="eyebrow">Performance over time</span>
          <h3>No observations yet</h3>
          <p>Metrics appear here once this landscape has recorded field measurements.</p>
        </section>
      </div>
    )
  }

  const categories = series.map((point) => new Date(point.date).getFullYear().toString())
  const carbon: Highcharts.Options = {
    ...sharedOptions(categories),
    series: [
      {
        type: 'areaspline',
        name: 'Carbon',
        data: series.map((point) => point.carbon),
        color: '#1b4d3a',
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, 'rgba(27,77,58,.28)'],
            [1, 'rgba(27,77,58,.02)'],
          ],
        },
        marker: { enabled: false },
        lineWidth: 2,
      },
    ],
  }
  const biodiversity: Highcharts.Options = {
    ...sharedOptions(categories),
    yAxis: { ...sharedOptions(categories).yAxis, min: 0, max: 100 },
    series: [
      {
        type: 'column',
        name: 'Biodiversity',
        data: series.map((point) => point.biodiversity),
        color: '#93aa87',
        borderWidth: 0,
        borderRadius: 2,
      },
    ],
  }

  return (
    <div className="charts-grid">
      <section className="chart-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Performance over time</span>
            <h3>Carbon sequestration</h3>
          </div>
          <span className="chart-unit">tCO₂e</span>
        </div>
        <ChartFrame key={`${id}-carbon`} options={carbon} />
      </section>
      <section className="chart-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Habitat quality</span>
            <h3>Biodiversity trend</h3>
          </div>
          <span className="chart-unit">INDEX / 100</span>
        </div>
        <ChartFrame key={`${id}-biodiversity`} options={biodiversity} />
      </section>
    </div>
  )
}
