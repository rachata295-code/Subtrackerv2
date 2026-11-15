import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { TextField } from './TextField';
import { CurrencyField } from './CurrencyField';
import { Switch } from './Switch';

afterEach(cleanup);

describe('<TextField>', () => {
  it('links the error to the input via aria-describedby', () => {
    render(<TextField label="ชื่อรายการ" error="กรุณากรอกชื่อ" />);
    const input = screen.getByLabelText('ชื่อรายการ');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)!.textContent).toContain('กรุณากรอกชื่อ');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('has no aria-describedby or aria-invalid without an error', () => {
    render(<TextField label="ชื่อรายการ" />);
    const input = screen.getByLabelText('ชื่อรายการ');
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('keeps a caller-provided aria-describedby alongside the error', () => {
    render(<TextField label="ชื่อ" error="ผิด" aria-describedby="hint" />);
    expect(screen.getByLabelText('ชื่อ').getAttribute('aria-describedby')).toContain('hint');
  });

  it('uses 16px text so iOS does not zoom on focus', () => {
    render(<TextField label="ชื่อ" />);
    expect(screen.getByLabelText('ชื่อ').className).toContain('text-base');
  });

  it('passes native props through', () => {
    const onChange = vi.fn();
    render(<TextField label="ชื่อ" placeholder="เช่น Netflix" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('ชื่อ'), { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('<CurrencyField>', () => {
  function Harness({ initial = null, error }: { initial?: number | null; error?: string }) {
    const [v, setV] = useState<number | null>(initial);
    return (
      <>
        <CurrencyField label="จำนวนเงิน" value={v} onChange={setV} error={error} />
        <output data-testid="value">{v === null ? 'null' : String(v)}</output>
      </>
    );
  }

  it('uses a decimal keypad', () => {
    render(<Harness />);
    expect(screen.getByLabelText('จำนวนเงิน').getAttribute('inputmode')).toBe('decimal');
  });

  it('keeps the raw text while typing and reports the parsed number', () => {
    render(<Harness />);
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1381.9' } });
    expect(input.value).toBe('1381.9');
    expect(screen.getByTestId('value').textContent).toBe('1381.9');
  });

  it('formats with separators on blur', () => {
    render(<Harness />);
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1381.93' } });
    fireEvent.blur(input);
    expect(input.value).toBe('1,381.93');
    expect(screen.getByTestId('value').textContent).toBe('1381.93');
  });

  it('reports null for unparsable text and leaves it untouched on blur', () => {
    render(<Harness initial={5} />);
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByTestId('value').textContent).toBe('null');
    fireEvent.blur(input);
    expect(input.value).toBe('abc');
  });

  it('shows the initial value formatted', () => {
    render(<Harness initial={3000} />);
    expect((screen.getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('3,000');
  });

  it('follows an external value change', () => {
    const { rerender } = render(<CurrencyField label="จำนวนเงิน" value={1} onChange={() => {}} />);
    rerender(<CurrencyField label="จำนวนเงิน" value={2500.5} onChange={() => {}} />);
    expect((screen.getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('2,500.5');
  });

  it('links the error to the input', () => {
    render(<Harness error="ต้องมากกว่า 0" />);
    const input = screen.getByLabelText('จำนวนเงิน');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toContain('ต้องมากกว่า 0');
  });
});

describe('<Switch>', () => {
  it('is a switch with aria-checked and calls onChange with the toggled value', () => {
    const onChange = vi.fn();
    render(<Switch label="แจ้งเตือน" checked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'แจ้งเตือน' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects checked and toggles off', () => {
    const onChange = vi.fn();
    render(<Switch label="แจ้งเตือน" checked onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'แจ้งเตือน' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('moves the thumb with transform only', () => {
    render(<Switch label="แจ้งเตือน" checked onChange={() => {}} />);
    expect(screen.getByTestId('switch-thumb').style.transform).toBe('translateX(20px)');
  });
});
