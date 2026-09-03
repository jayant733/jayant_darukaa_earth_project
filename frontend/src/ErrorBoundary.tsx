import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Globe2 } from 'lucide-react'

type State = { failed: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('Darukaa render error', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="fatal-state">
        <Globe2 />
        <span className="eyebrow">Workspace interrupted</span>
        <h1>Darukaa needs a fresh start.</h1>
        <p>Your data is safe. Reload the workspace to continue.</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </main>
    )
  }
}
