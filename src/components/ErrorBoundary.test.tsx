import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('kaboom');
  return <div>all good</div>;
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let reload: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    // React logs the caught error itself; silence it so a passing run stays readable.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    reload = vi.fn();
    originalLocation = window.location;
    // jsdom's location.reload throws "Not implemented", so swap the whole object.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('renders the fallback instead of unmounting to a blank page', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('all good')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload trip planner/i })).toBeInTheDocument();
  });

  it('logs the error so it is recoverable from the console until reporting exists', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(consoleError).toHaveBeenCalledWith(
      'Unhandled render error:',
      expect.objectContaining({ message: 'kaboom' }),
      expect.anything()
    );
  });

  it('reloads the page when the reload button is pressed', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /reload trip planner/i }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('keeps the stack hidden until asked for, then toggles it back', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.queryByText(/kaboom/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show technical details/i }));
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hide technical details/i }));
    expect(screen.queryByText(/kaboom/)).not.toBeInTheDocument();
  });
});
