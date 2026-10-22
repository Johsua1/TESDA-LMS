import { Component } from 'react'

// Last-resort UI for an unexpected render error. Without a boundary React
// unmounts the whole tree and the user is left staring at a blank page with no
// way back — which also looks like "the system is down" during UAT.
//
// Deliberately context-free: it must render even when the store itself threw.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Console only. Never log tokens, passwords or profile rows here — the
    // stack is enough to reproduce the fault.
    console.error('Unexpected UI error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-800">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">
            This page could not be displayed. Your saved records are safe — reload to continue.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/login'
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
