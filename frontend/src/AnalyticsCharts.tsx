import { useEffect, useRef, useState } from 'react'
import Highcharts from 'highcharts'
import type { SeriesPoint } from './api'

function chartLib() {
  const module = Highcharts as unknown as { default?: typeof Highcharts }
  return module.default ?? Highcharts
}

function ChartFrame({
  options,
  description,
}: {
  options: Highcharts.Options
  description: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const node = host.current
    if (!node) return
    let chart: Highcharts.Chart
    try {
      chart = chartLib().chart(node, options)
    } catch {
      queueMicrotask(() => setFailed(true))
      return
    }
    return () => {
      chart.destroy()
    }
  }, [options])

  if (failed) return <p className="chart-error">This chart is temporarily unavailable.</p>
  return <div ref={host} role="img" aria-label={description} />
}

function sharedOptions(categories: string[]): Highcharts.Options {
  return {
    chart: { backgroundColor: 'transparent', height: 245, spacing: [12, 4, 8, 0] },
    title: { text: undefined },
    credits: { enabled: false },
    accessibility: { enabled: false },
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
  const [rangeYears, setRangeYears] = useState<number | 'all'>('all')

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

  const latestTimestamp = Math.max(...series.map((point) => new Date(point.date).getTime()))
  const visibleSeries =
    rangeYears === 'all'
      ? series
      : series.filter(
          (point) =>
            new Date(point.date).getTime() >=
            new Date(latestTimestamp).setFullYear(
              new Date(latestTimestamp).getFullYear() - rangeYears,
            ),
        )
  const categories = visibleSeries.map((point) => new Date(point.date).getFullYear().toString())
  const period = `${categories[0]} to ${categories[categories.length - 1]}`
  const carbon: Highcharts.Options = {
    ...sharedOptions(categories),
    series: [
      {
        type: 'areaspline',
        name: 'Carbon',
        data: visibleSeries.map((point) => point.carbon),
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
        data: visibleSeries.map((point) => point.biodiversity),
        color: '#93aa87',
        borderWidth: 0,
        borderRadius: 2,
      },
    ],
  }
  const restoration: Highcharts.Options = {
    ...sharedOptions(categories),
    yAxis: { ...sharedOptions(categories).yAxis, min: 0, max: 100 },
    series: [
      {
        type: 'line',
        name: 'Restoration progress',
        data: visibleSeries.map((point) => point.progress),
        color: '#4f7747',
        marker: { enabled: true, radius: 3 },
        lineWidth: 2,
      },
    ],
  }

  return (
    <section className="analytics-series">
      <div className="analytics-range">
        <span className="eyebrow">Chart period</span>
        <label>
          <span className="sr-only">Filter analytics by date range</span>
          <select
            value={rangeYears}
            onChange={(event) =>
              setRangeYears(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
          >
            <option value="all">All observations</option>
            <option value="1">Latest year</option>
            <option value="3">Latest 3 years</option>
            <option value="5">Latest 5 years</option>
          </select>
        </label>
      </div>
      <div className="charts-grid">
        <section className="chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Performance over time</span>
              <h3>Carbon sequestration</h3>
            </div>
            <span className="chart-unit">tCO₂e</span>
          </div>
          <ChartFrame
            key={`${id}-carbon`}
            options={carbon}
            description={`Carbon sequestration from ${period}, ending at ${visibleSeries.at(-1)?.carbon.toLocaleString()} tonnes of carbon dioxide equivalent.`}
          />
        </section>
        <section className="chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Habitat quality</span>
              <h3>Biodiversity trend</h3>
            </div>
            <span className="chart-unit">INDEX / 100</span>
          </div>
          <ChartFrame
            key={`${id}-biodiversity`}
            options={biodiversity}
            description={`Biodiversity index from ${period}, ending at ${visibleSeries.at(-1)?.biodiversity} out of 100.`}
          />
        </section>
        <section className="chart-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Delivery against plan</span>
              <h3>Restoration progress</h3>
            </div>
            <span className="chart-unit">PERCENT</span>
          </div>
          <ChartFrame
            key={`${id}-restoration`}
            options={restoration}
            description={`Restoration progress from ${period}, ending at ${visibleSeries.at(-1)?.progress} percent.`}
          />
        </section>
      </div>
    </section>
  )
}
