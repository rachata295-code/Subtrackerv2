import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional reload callback for tests; defaults to reloading the browser window. */
  onReload?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Preserve diagnostics in console without exposing internal stack traces to the UI.
    console.error('Uncaught app error:', error, info.componentStack);
  }

  private handleReload = () => {
    if (this.props.onReload) {
      this.setState({ hasError: false });
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col justify-center bg-ground px-screen py-6">
          <main>
            <Card role="alert" className="flex flex-col items-start gap-3">
              <h1 className="text-title font-semibold text-text">เกิดข้อผิดพลาดที่ไม่คาดคิด</h1>
              <p className="text-sm text-muted">ขออภัย แอปไม่สามารถแสดงหน้านี้ได้ในขณะนี้ กรุณาโหลดหน้าใหม่อีกครั้ง</p>
              <Button variant="primary" size="lg" className="mt-1 w-full" onClick={this.handleReload}>
                โหลดใหม่
              </Button>
            </Card>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}
