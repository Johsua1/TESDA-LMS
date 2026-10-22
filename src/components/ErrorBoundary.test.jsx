import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ErrorBoundary } from './ErrorBoundary'

describe('ErrorBoundary', () => {
  it('renders its children while there is no error', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <p>DASHBOARD CONTENT</p>
      </ErrorBoundary>,
    )
    expect(html).toContain('DASHBOARD CONTENT')
  })

  it('turns a render error into a recoverable screen instead of a blank page', () => {
    const boundary = new ErrorBoundary({ children: null })
    boundary.state = { error: new Error('boom') }
    const html = renderToStaticMarkup(boundary.render())
    expect(html).toContain('Something went wrong')
    expect(html).toContain('Reload page')
    expect(html).toContain('Back to sign in')
    // The raw error message must not leak into the page.
    expect(html).not.toContain('boom')
  })
})
