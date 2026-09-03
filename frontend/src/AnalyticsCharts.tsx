import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import type { Project } from './data'

const base: Highcharts.Options = {
  chart: { backgroundColor: 'transparent', height: 245, spacing: [12, 4, 8, 0] },
  title: { text: undefined },
  credits: { enabled: false },
  legend: { enabled: false },
  xAxis: {
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

export function AnalyticsCharts({ project }: { project: Project }) {
  const categories = project.series.map((point) => point.year)
  const carbon: Highcharts.Options = {
    ...base,
    xAxis: { ...base.xAxis, categories },
    series: [
      {
        type: 'areaspline',
        name: 'Carbon',
        data: project.series.map((point) => point.carbon),
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
    ...base,
    xAxis: { ...base.xAxis, categories },
    yAxis: { ...base.yAxis, min: 40, max: 100 },
    series: [
      {
        type: 'column',
        name: 'Biodiversity',
        data: project.series.map((point) => point.biodiversity),
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
        <HighchartsReact highcharts={Highcharts} options={carbon} />
      </section>
      <section className="chart-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Habitat quality</span>
            <h3>Biodiversity trend</h3>
          </div>
          <span className="chart-unit">INDEX / 100</span>
        </div>
        <HighchartsReact highcharts={Highcharts} options={biodiversity} />
      </section>
    </div>
  )
}
