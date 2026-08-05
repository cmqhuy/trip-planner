import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  showDetails: boolean;
}

/**
 * Catches render-phase throws anywhere below it.
 *
 * Without this, React unmounts the entire tree on an unhandled render error and
 * the user is left on a blank page with no way back — indistinguishable from
 * losing their data. The fallback keeps a route out of that state.
 *
 * There is no error-reporting backend yet: a crash here leaves no record beyond
 * the user's own console, so nobody finds out. That is a deliberate choice — no
 * third-party reporter was added, because the planned backend can receive these
 * itself without involving another vendor.
 *
 * `componentDidCatch` below is the seam: it already has everything a report
 * needs. When the backend exists, POST from there. Send the caught error only —
 * never trip content.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    const { error, showDetails } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary-screen">
        <div className="error-boundary-panel glass-panel">
          <div className="error-boundary-icon">
            <AlertTriangle size={26} />
          </div>

          <h1 className="error-boundary-title">Something went wrong</h1>

          <p className="error-boundary-message">
            Trip Planner hit an unexpected error while drawing the page. Your saved trips
            are still stored in this browser — reloading usually clears it.
          </p>

          <div className="error-boundary-actions">
            <button type="button" className="btn-primary error-boundary-btn" onClick={this.handleReload}>
              <RotateCw size={15} />
              Reload Trip Planner
            </button>
          </div>

          <button type="button" className="error-boundary-details-toggle" onClick={this.toggleDetails}>
            {showDetails ? 'Hide technical details' : 'Show technical details'}
          </button>

          {showDetails && (
            <pre className="error-boundary-stack">
              {error.stack || `${error.name}: ${error.message}`}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
