import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { financeFixture } from '../fixtures/finance';
import * as financeHooks from './useFinance';
import { clearAllDrafts, useDraft } from './useDraft';
import { EntrySheet } from '../pages/entries/EntrySheet';
import { SubscriptionSheet } from '../pages/bills/SubscriptionSheet';
import { InstallmentSheet } from '../pages/bills/InstallmentSheet';
import { PlanItemSheet } from '../pages/plan/PlanItemSheet';
import { BalanceCheckSheet } from '../pages/plan/BalanceCheckSheet';
import { RecurringIncomeSheet } from '../pages/settings/RecurringIncomeSheet';

// Mock ThemeProvider so Toaster does not touch localStorage under jsdom (which prints a Node ExperimentalWarning).
vi.mock('../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

beforeEach(() => {
  clearAllDrafts();
});

afterEach(() => {
  cleanup();
  clearAllDrafts();
  vi.restoreAllMocks();
});

describe('useDraft', () => {
  it('stores draft in module memory (never localStorage/sessionStorage) and restores on reopen', () => {
    const draftsSource = readFileSync(resolve(process.cwd(), 'src/lib/drafts.ts'), 'utf8');
    expect(draftsSource).not.toMatch(/localStorage\s*\./);
    expect(draftsSource).not.toMatch(/sessionStorage\s*\./);
    const sampleTx = financeFixture.transactions[0]!;
    const initial = { amount: null as number | null, note: '' };

    const { result, unmount } = renderHook(() => useDraft('quick-add-test', initial));
    expect(result.current.value).toEqual(initial);
    expect(result.current.hasDraft).toBe(false);

    act(() => {
      result.current.setValue({
        amount: sampleTx.amount / 100,
        note: sampleTx.note,
      });
    });

    expect(result.current.value).toEqual({
      amount: sampleTx.amount / 100,
      note: sampleTx.note,
    });
    expect(result.current.hasDraft).toBe(true);

    // Simulate closing the sheet (unmount) without calling clear()
    unmount();

    // Reopening the sheet (remount) restores the draft from module memory
    const reopened = renderHook(() => useDraft('quick-add-test', initial));
    expect(reopened.result.current.value).toEqual({
      amount: sampleTx.amount / 100,
      note: sampleTx.note,
    });
    expect(reopened.result.current.hasDraft).toBe(true);
  });

  it('clears draft on clear() so both current state and next mount return to initial', () => {
    const sub = financeFixture.subscriptions[0]!;
    const initial = () => ({ name: '', amount: null as number | null });

    const { result, unmount } = renderHook(() => useDraft('sub-test', initial));
    act(() => {
      const [, setDraft] = result.current;
      setDraft({ name: sub.name, amount: sub.amount / 100 });
    });
    expect(result.current[0]).toEqual({ name: sub.name, amount: sub.amount / 100 });

    act(() => {
      const [, , clear] = result.current;
      clear();
    });
    expect(result.current[0]).toEqual({ name: '', amount: null });
    expect(result.current.hasDraft).toBe(false);

    unmount();

    const reopened = renderHook(() => useDraft('sub-test', initial));
    expect(reopened.result.current[0]).toEqual({ name: '', amount: null });
  });

  it('bypasses draft storage when editing (key is null or enabled is false)', () => {
    const existing = financeFixture.transactions[0]!;
    const newInitial = { note: '', amount: null as number | null };

    // 1. User types a draft in "add" mode and closes
    const addHook = renderHook(() => useDraft('entry-test', newInitial));
    act(() => {
      addHook.result.current.setValue({ note: 'ร่างที่พิมพ์ค้างไว้', amount: 105 });
    });
    addHook.unmount();

    // 2. User opens "edit" mode (key = null or enabled = false) -> must show existing item, not draft
    const editInitial = { note: existing.note, amount: existing.amount / 100 };
    const editHook = renderHook(() => useDraft('entry-test', editInitial, { enabled: false }));
    expect(editHook.result.current.value).toEqual(editInitial);

    act(() => {
      editHook.result.current.setValue({ note: 'แก้รายการเดิม', amount: 200 });
    });
    editHook.unmount();

    // 3. Reopening "add" mode still has the original draft intact
    const addReopened = renderHook(() => useDraft('entry-test', newInitial));
    expect(addReopened.result.current.value).toEqual({
      note: 'ร่างที่พิมพ์ค้างไว้',
      amount: 105,
    });
  });

  it('EntrySheet preserves draft across close/reopen, skips draft when editing, and clears after save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const existingTx = financeFixture.transactions[0]!;

    const baseProps = {
      sources: financeFixture.sources,
      pots: financeFixture.pots,
      balanceChecks: financeFixture.balanceChecks,
      today: '2026-11-15',
      onSave,
      onDelete,
    };

    const { rerender } = render(
      createElement(EntrySheet, { ...baseProps, open: true, onOpenChange: () => {}, editing: null }),
    );

    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '85' } });
    fireEvent.change(within(dialog).getByLabelText('โน้ต'), { target: { value: 'ชานมร่าง' } });

    // Close without saving
    rerender(createElement(EntrySheet, { ...baseProps, open: false, onOpenChange: () => {}, editing: null }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // Open in edit mode -> must show existingTx, not the draft
    rerender(createElement(EntrySheet, { ...baseProps, open: true, onOpenChange: () => {}, editing: existingTx }));
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('โน้ต') as HTMLInputElement).value).toBe(existingTx.note);

    // Reopen in add mode -> draft is still preserved
    rerender(createElement(EntrySheet, { ...baseProps, open: false, onOpenChange: () => {}, editing: null }));
    rerender(createElement(EntrySheet, { ...baseProps, open: true, onOpenChange: () => {}, editing: null }));
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('85');
    expect((within(dialog).getByLabelText('โน้ต') as HTMLInputElement).value).toBe('ชานมร่าง');

    // Save -> clears draft
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    rerender(createElement(EntrySheet, { ...baseProps, open: false, onOpenChange: () => {}, editing: null }));
    rerender(createElement(EntrySheet, { ...baseProps, open: true, onOpenChange: () => {}, editing: null }));
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('');
    expect((within(dialog).getByLabelText('โน้ต') as HTMLInputElement).value).toBe('');
  });

  it('SubscriptionSheet and InstallmentSheet preserve drafts on close/reopen, skip drafts when editing, and clear after save', async () => {
    const existingSub = financeFixture.subscriptions[0]!;
    const existingInst = financeFixture.installments[0]!;
    const upsertSubSpy = vi.fn().mockResolvedValue(existingSub);
    const upsertInstSpy = vi.fn().mockResolvedValue(existingInst);

    vi.spyOn(financeHooks, 'useUpsertSubscription').mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: upsertSubSpy,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof financeHooks.useUpsertSubscription>);
    vi.spyOn(financeHooks, 'useDeleteSubscription').mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof financeHooks.useDeleteSubscription>);
    vi.spyOn(financeHooks, 'useUpsertInstallment').mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: upsertInstSpy,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof financeHooks.useUpsertInstallment>);
    vi.spyOn(financeHooks, 'useDeleteInstallment').mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof financeHooks.useDeleteInstallment>);

    // 1. SubscriptionSheet
    const { rerender, unmount } = render(
      createElement(SubscriptionSheet, { open: true, onOpenChange: () => {}, data: financeFixture }),
    );
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('ชื่อสมาชิก'), { target: { value: 'Netflix' } });
    fireEvent.change(within(dialog).getByLabelText('ยอดเงิน'), { target: { value: '169' } });
    fireEvent.change(within(dialog).getByLabelText('วันตัดเงิน (1–31)'), { target: { value: '12' } });

    rerender(createElement(SubscriptionSheet, { open: false, onOpenChange: () => {}, data: financeFixture }));
    // Edit mode ignores draft
    rerender(
      createElement(SubscriptionSheet, {
        open: true,
        onOpenChange: () => {},
        data: financeFixture,
        initial: existingSub,
      }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อสมาชิก') as HTMLInputElement).value).toBe(existingSub.name);

    // Reopen add mode restores draft
    rerender(createElement(SubscriptionSheet, { open: false, onOpenChange: () => {}, data: financeFixture }));
    rerender(createElement(SubscriptionSheet, { open: true, onOpenChange: () => {}, data: financeFixture }));
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อสมาชิก') as HTMLInputElement).value).toBe('Netflix');
    expect((within(dialog).getByLabelText('ยอดเงิน') as HTMLInputElement).value).toBe('169');

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(upsertSubSpy).toHaveBeenCalledTimes(1));

    rerender(createElement(SubscriptionSheet, { open: false, onOpenChange: () => {}, data: financeFixture }));
    rerender(createElement(SubscriptionSheet, { open: true, onOpenChange: () => {}, data: financeFixture }));
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อสมาชิก') as HTMLInputElement).value).toBe('');
    unmount();

    // 2. InstallmentSheet
    const instView = render(
      createElement(InstallmentSheet, {
        open: true,
        onOpenChange: () => {},
        data: financeFixture,
        today: '2026-11-15',
      }),
    );
    dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('ชื่อรายการ'), { target: { value: 'iPad' } });
    fireEvent.change(within(dialog).getByLabelText('ยอดต่องวด'), { target: { value: '1500' } });
    fireEvent.change(within(dialog).getByLabelText('จำนวนงวด'), { target: { value: '10' } });

    instView.rerender(
      createElement(InstallmentSheet, {
        open: false,
        onOpenChange: () => {},
        data: financeFixture,
        today: '2026-11-15',
      }),
    );
    // Edit mode ignores draft
    instView.rerender(
      createElement(InstallmentSheet, {
        open: true,
        onOpenChange: () => {},
        data: financeFixture,
        today: '2026-11-15',
        initial: existingInst,
      }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe(existingInst.name);

    // Reopen add mode restores draft
    instView.rerender(
      createElement(InstallmentSheet, {
        open: false,
        onOpenChange: () => {},
        data: financeFixture,
        today: '2026-11-15',
      }),
    );
    instView.rerender(
      createElement(InstallmentSheet, {
        open: true,
        onOpenChange: () => {},
        data: financeFixture,
        today: '2026-11-15',
      }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe('iPad');
    expect((within(dialog).getByLabelText('ยอดต่องวด') as HTMLInputElement).value).toBe('1,500');

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(upsertInstSpy).toHaveBeenCalledTimes(1));

    instView.rerender(
      createElement(InstallmentSheet, {
        open: false,
        onOpenChange: () => {},
        data: financeFixture,
        today: '2026-11-15',
      }),
    );
    instView.rerender(
      createElement(InstallmentSheet, {
        open: true,
        onOpenChange: () => {},
        data: financeFixture,
        today: '2026-11-15',
      }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe('');
  });

  it('PlanItemSheet, BalanceCheckSheet, and RecurringIncomeSheet preserve drafts on close/reopen, skip drafts when editing, and clear after save', async () => {
    const onSavePlan = vi.fn().mockResolvedValue(undefined);
    const onSaveIncome = vi.fn().mockResolvedValue(undefined);
    const existingPlan = financeFixture.planItems[0]!;
    const existingIncome = financeFixture.recurringIncomes[0]!;
    const bank = financeFixture.sources[0]!;
    const createBalanceCheckSpy = vi.fn().mockResolvedValue(financeFixture.balanceChecks[0]!);

    vi.spyOn(financeHooks, 'useCreateBalanceCheck').mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: createBalanceCheckSpy,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof financeHooks.useCreateBalanceCheck>);
    vi.spyOn(financeHooks, 'useCreateTransaction').mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof financeHooks.useCreateTransaction>);

    const queryClient = new QueryClient();

    // 1. PlanItemSheet
    const planBase = {
      data: financeFixture,
      periodKey: '2026-11',
      defaultSourceId: bank.id,
      onSave: onSavePlan,
      onDelete: vi.fn(),
    };
    const planView = render(
      createElement(PlanItemSheet, { ...planBase, open: true, onOpenChange: () => {}, editing: null }),
    );
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('ชื่อรายการ'), { target: { value: 'ค่าไฟ' } });
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '800' } });

    planView.rerender(
      createElement(PlanItemSheet, { ...planBase, open: false, onOpenChange: () => {}, editing: null }),
    );
    planView.rerender(
      createElement(PlanItemSheet, { ...planBase, open: true, onOpenChange: () => {}, editing: existingPlan }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe(existingPlan.name);

    planView.rerender(
      createElement(PlanItemSheet, { ...planBase, open: false, onOpenChange: () => {}, editing: null }),
    );
    planView.rerender(
      createElement(PlanItemSheet, { ...planBase, open: true, onOpenChange: () => {}, editing: null }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe('ค่าไฟ');
    expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('800');

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(onSavePlan).toHaveBeenCalledTimes(1));

    planView.rerender(
      createElement(PlanItemSheet, { ...planBase, open: false, onOpenChange: () => {}, editing: null }),
    );
    planView.rerender(
      createElement(PlanItemSheet, { ...planBase, open: true, onOpenChange: () => {}, editing: null }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe('');
    planView.unmount();

    // 2. BalanceCheckSheet
    const checkBase = {
      data: financeFixture,
      bank,
      expected: 468_000,
      latestCheckedOn: '2026-11-10',
      today: '2026-11-15',
    };
    const checkView = render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(BalanceCheckSheet, { ...checkBase, open: true, onOpenChange: () => {} }),
      ),
    );
    dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('ยอดจริงในบัญชี'), { target: { value: '4680' } });

    checkView.rerender(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(BalanceCheckSheet, { ...checkBase, open: false, onOpenChange: () => {} }),
      ),
    );
    checkView.rerender(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(BalanceCheckSheet, { ...checkBase, open: true, onOpenChange: () => {} }),
      ),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ยอดจริงในบัญชี') as HTMLInputElement).value).toBe('4,680');

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกยอด' }));
    await waitFor(() => expect(createBalanceCheckSpy).toHaveBeenCalledTimes(1));

    checkView.rerender(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(BalanceCheckSheet, { ...checkBase, open: false, onOpenChange: () => {} }),
      ),
    );
    checkView.rerender(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(BalanceCheckSheet, { ...checkBase, open: true, onOpenChange: () => {} }),
      ),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ยอดจริงในบัญชี') as HTMLInputElement).value).toBe('');
    checkView.unmount();

    // 3. RecurringIncomeSheet
    const incBase = {
      data: financeFixture,
      onSave: onSaveIncome,
      onDelete: vi.fn(),
    };
    const incView = render(
      createElement(RecurringIncomeSheet, { ...incBase, open: true, onOpenChange: () => {}, editing: null }),
    );
    dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('ชื่อรายการ'), { target: { value: 'เงินพิเศษ' } });
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '2500' } });
    fireEvent.change(within(dialog).getByLabelText('วันที่เข้าของเดือน (1–31)'), { target: { value: '15' } });

    incView.rerender(
      createElement(RecurringIncomeSheet, { ...incBase, open: false, onOpenChange: () => {}, editing: null }),
    );
    incView.rerender(
      createElement(RecurringIncomeSheet, {
        ...incBase,
        open: true,
        onOpenChange: () => {},
        editing: existingIncome,
      }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe(existingIncome.name);

    incView.rerender(
      createElement(RecurringIncomeSheet, { ...incBase, open: false, onOpenChange: () => {}, editing: null }),
    );
    incView.rerender(
      createElement(RecurringIncomeSheet, { ...incBase, open: true, onOpenChange: () => {}, editing: null }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe('เงินพิเศษ');
    expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('2,500');

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(onSaveIncome).toHaveBeenCalledTimes(1));

    incView.rerender(
      createElement(RecurringIncomeSheet, { ...incBase, open: false, onOpenChange: () => {}, editing: null }),
    );
    incView.rerender(
      createElement(RecurringIncomeSheet, { ...incBase, open: true, onOpenChange: () => {}, editing: null }),
    );
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('ชื่อรายการ') as HTMLInputElement).value).toBe('');
  });
});
