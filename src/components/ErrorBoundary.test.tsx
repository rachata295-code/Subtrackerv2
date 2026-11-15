import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('render explosion');
  }
  return <p>ปกติ</p>;
}

describe('<ErrorBoundary>', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('ปกติ')).toBeTruthy();
  });

  it('catches render errors and displays Thai message with reload button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReload = vi.fn();

    render(
      <ErrorBoundary onReload={onReload}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('เกิดข้อผิดพลาดที่ไม่คาดคิด')).toBeTruthy();
    const reloadBtn = screen.getByRole('button', { name: 'โหลดใหม่' });
    fireEvent.click(reloadBtn);
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
