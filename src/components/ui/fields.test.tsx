import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import * as domain from '../../domain';
import { parseAmount } from '../../lib/parseAmount';
import type { AmountExpressionResult } from '../../types/finance';
import { TextField } from './TextField';
import { CurrencyField } from './CurrencyField';
import { SelectField } from './SelectField';
import { Switch } from './Switch';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Uses real domain.evaluateAmountExpression when implemented, or SPEC §4 B1 rules while stubbed. */
function specEvaluateAmountExpression(text: string): AmountExpressionResult {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'กรอกจำนวนเงินให้ถูกต้อง' };
  const normalized = trimmed.replace(/\u2212/g, '-');
  if (/[^0-9.,+\-\s฿]/.test(normalized)) return { error: 'รูปแบบตัวเลขไม่ถูกต้อง' };
  const parts = normalized.split(/([+-])/);
  if (parts.length === 0 || parts[0] === '' || parts[parts.length - 1] === '') {
    return { error: 'นิพจน์ไม่สมบูรณ์' };
  }
  let total = 0;
  let op = 1;
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i]!.trim();
    if (i % 2 === 1) {
      op = token === '-' ? -1 : 1;
      continue;
    }
    const parsed = parseAmount(token);
    if (parsed === null) return { error: 'รูปแบบตัวเลขไม่ถูกต้อง' };
    total += op * Math.round(Number((parsed * 100).toPrecision(15)));
  }
  if (total <= 0) return { error: 'ยอดต้องมากกว่า 0' };
  return { value: total };
}

function spyEvaluateExpression() {
  const orig = domain.evaluateAmountExpression;
  return vi.spyOn(domain, 'evaluateAmountExpression').mockImplementation((text: string) => {
    try {
      return orig(text);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('not implemented')) {
        return specEvaluateAmountExpression(text);
      }
      throw err;
    }
  });
}

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

  it('evaluates + and - / − expressions via evaluateAmountExpression and shows "= ฿140.00" preview', () => {
    const spy = spyEvaluateExpression();
    render(<Harness />);
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '45+60+35' } });
    expect(spy).toHaveBeenCalledWith('45+60+35');
    expect(screen.getByTestId('value').textContent).toBe('140');
    expect(screen.getByText('= ฿140.00')).toBeTruthy();

    fireEvent.change(input, { target: { value: '1,200+45.50' } });
    expect(screen.getByTestId('value').textContent).toBe('1245.5');
    expect(screen.getByText('= ฿1,245.50')).toBeTruthy();

    // Real Unicode minus U+2212 also evaluates cleanly.
    fireEvent.change(input, { target: { value: '120−15' } });
    expect(screen.getByTestId('value').textContent).toBe('105');
    expect(screen.getByText('= ฿105.00')).toBeTruthy();

    // Plain single numbers do not show the "= ฿..." preview.
    fireEvent.change(input, { target: { value: '140' } });
    expect(screen.getByTestId('value').textContent).toBe('140');
    expect(screen.queryByText(/^= ฿/)).toBeNull();
  });

  it('shows expression errors under the field without crashing and reports null', () => {
    spyEvaluateExpression();
    render(<Harness />);
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '10-20' } });
    expect(screen.getByTestId('value').textContent).toBe('null');
    expect(screen.getByText('ยอดต้องมากกว่า 0')).toBeTruthy();
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toContain('ยอดต้องมากกว่า 0');

    fireEvent.change(input, { target: { value: '45+' } });
    expect(screen.getByTestId('value').textContent).toBe('null');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(input, { target: { value: '45*2' } });
    expect(screen.getByTestId('value').textContent).toBe('null');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows + and − operator buttons only on coarse pointer (touch) devices and inserts operators', () => {
    spyEvaluateExpression();
    const stubCoarse = (coarse: boolean) => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(pointer: coarse)' ? coarse : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }));
    };

    stubCoarse(false);
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole('button', { name: 'บวก' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ลบ' })).toBeNull();
    unmount();

    stubCoarse(true);
    render(<Harness />);
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement;
    const plusBtn = screen.getByRole('button', { name: 'บวก' });
    const minusBtn = screen.getByRole('button', { name: 'ลบ' });
    expect(plusBtn.className).toContain('min-h-tap');
    expect(minusBtn.className).toContain('min-h-tap');

    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.click(plusBtn);
    expect(input.value).toBe('45+');
    fireEvent.change(input, { target: { value: '45+60' } });
    fireEvent.click(minusBtn);
    expect(input.value).toBe('45+60−');
    fireEvent.change(input, { target: { value: '45+60−5' } });
    expect(screen.getByTestId('value').textContent).toBe('100');
    expect(screen.getByText('= ฿100.00')).toBeTruthy();
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

describe('<SelectField>', () => {
  it('renders label, options, and links error via aria-describedby', () => {
    render(
      <SelectField
        label="ช่องทาง"
        options={[
          { value: 'bank', label: 'บัญชี' },
          { value: 'card', label: 'บัตรเครดิต' },
        ]}
        value="bank"
        onChange={() => {}}
        error="กรุณาเลือกช่องทาง"
      />,
    );
    const select = screen.getByLabelText('ช่องทาง') as HTMLSelectElement;
    expect(select.value).toBe('bank');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    const describedBy = select.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)!.textContent).toContain('กรุณาเลือกช่องทาง');
  });
});
