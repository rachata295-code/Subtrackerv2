import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { notify } from '../../components/ui/Toaster';
import {
  useDeleteInstallment,
  useDeleteSubscription,
  useFinanceData,
  useUpsertInstallment,
  useUpsertSubscription,
} from '../../hooks/useFinance';
import type { ISODate, Installment, Subscription } from '../../types/finance';
import { BillsSummaryCard } from './BillsSummaryCard';
import { BillsTab } from './BillsTab';
import { InstallmentSheet } from './InstallmentSheet';
import { InstallmentsTab } from './InstallmentsTab';
import { SubscriptionSheet } from './SubscriptionSheet';
import { SubscriptionsTab } from './SubscriptionsTab';
import { formatRepoError, todayBangkok } from './billsLogic';

type BillsSegment = 'bills' | 'installments' | 'subscriptions';

const SEGMENT_OPTIONS: { value: BillsSegment; label: string }[] = [
  { value: 'bills', label: 'บิล' },
  { value: 'installments', label: 'ผ่อน' },
  { value: 'subscriptions', label: 'สมาชิก' },
];

export interface BillsPageProps {
  /** Optional clock injection for deterministic tests (Asia/Bangkok YYYY-MM-DD). */
  today?: ISODate;
}

export default function BillsPage({ today = todayBangkok() }: BillsPageProps) {
  const { data, isLoading, error, refetch } = useFinanceData();
  const upsertInstallment = useUpsertInstallment();
  const deleteInstallment = useDeleteInstallment();
  const upsertSubscription = useUpsertSubscription();
  const deleteSubscription = useDeleteSubscription();
  const [segment, setSegment] = useState<BillsSegment>('bills');
  const [instSheetOpen, setInstSheetOpen] = useState(false);
  const [editingInst, setEditingInst] = useState<Installment | undefined>(undefined);
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | undefined>(undefined);

  const handleDeleteInstallment = async (inst: Installment): Promise<boolean> => {
    const { id: _id, ...snapshot } = inst;
    try {
      await deleteInstallment.mutateAsync(inst.id);
    } catch (err) {
      toast.error(formatRepoError('ลบไม่สำเร็จ', err, 'ลบไม่สำเร็จ กรุณาลองใหม่'));
      return false;
    }
    let undone = false;
    notify(`ลบ${inst.name}แล้ว`, {
      undo: () => {
        if (undone) return;
        undone = true;
        void upsertInstallment.mutateAsync(snapshot).catch((err) => {
          toast.error(formatRepoError('เลิกทำไม่สำเร็จ', err, 'เลิกทำไม่สำเร็จ'));
        });
      },
    });
    return true;
  };

  const handleDeleteSubscription = async (sub: Subscription): Promise<boolean> => {
    const { id: _id, ...snapshot } = sub;
    try {
      await deleteSubscription.mutateAsync(sub.id);
    } catch (err) {
      toast.error(formatRepoError('ลบไม่สำเร็จ', err, 'ลบไม่สำเร็จ กรุณาลองใหม่'));
      return false;
    }
    let undone = false;
    notify(`ลบ${sub.name}แล้ว`, {
      undo: () => {
        if (undone) return;
        undone = true;
        void upsertSubscription.mutateAsync(snapshot).catch((err) => {
          toast.error(formatRepoError('เลิกทำไม่สำเร็จ', err, 'เลิกทำไม่สำเร็จ'));
        });
      },
    });
    return true;
  };

  const openAddInstallment = () => {
    setEditingInst(undefined);
    setInstSheetOpen(true);
  };

  const openEditInstallment = (inst: Installment) => {
    setEditingInst(inst);
    setInstSheetOpen(true);
  };

  const openAddSubscription = () => {
    setEditingSub(undefined);
    setSubSheetOpen(true);
  };

  const openEditSubscription = (sub: Subscription) => {
    setEditingSub(sub);
    setSubSheetOpen(true);
  };

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-title font-semibold text-text">บิล & ผ่อน</h1>
        {data && segment === 'installments' ? (
          <IconButton
            label="เพิ่มรายการผ่อน"
            icon={<Plus size={22} strokeWidth={1.6} aria-hidden="true" />}
            onClick={openAddInstallment}
            className="!bg-accent !text-on-accent hover-fine:enabled:hover:opacity-90"
          />
        ) : null}
        {data && segment === 'subscriptions' ? (
          <IconButton
            label="เพิ่มสมาชิก"
            icon={<Plus size={22} strokeWidth={1.6} aria-hidden="true" />}
            onClick={openAddSubscription}
            className="!bg-accent !text-on-accent hover-fine:enabled:hover:opacity-90"
          />
        ) : null}
      </header>

      <div className="mt-4">
        <SegmentedControl
          label="หมวดหมู่บิลและผ่อน"
          options={SEGMENT_OPTIONS}
          value={segment}
          onChange={setSegment}
        />
      </div>

      <section className="mt-4">
        {isLoading ? (
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-2/3" />
          </Card>
        ) : error ? (
          <Card className="flex flex-col items-start gap-3" role="alert">
            <p className="text-sm text-negative">โหลดข้อมูลบิลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
            {refetch ? (
              <Button variant="secondary" onClick={() => refetch()}>
                ลองใหม่
              </Button>
            ) : null}
          </Card>
        ) : !data ? (
          <Card>
            <EmptyState message="ยังไม่มีข้อมูลบิลและรายการผ่อน" />
          </Card>
        ) : (
          <div
            data-testid="bills-layout"
            className="flex flex-col gap-gap lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6"
          >
            {/* Mobile (<768px) hides the summary to stay unchanged; tablet shows it above บิล only; desktop pins it right. */}
            <aside
              aria-label="สรุปรอบนี้"
              className={[
                segment === 'bills' ? 'hidden md:block' : 'hidden lg:block',
                'lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1',
              ].join(' ')}
            >
              <BillsSummaryCard data={data} today={today} />
            </aside>

            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              {segment === 'bills' ? (
                <BillsTab data={data} today={today} />
              ) : segment === 'installments' ? (
                <InstallmentsTab
                  data={data}
                  today={today}
                  onEdit={openEditInstallment}
                  onDelete={handleDeleteInstallment}
                />
              ) : (
                <SubscriptionsTab
                  data={data}
                  onEdit={openEditSubscription}
                  onDelete={handleDeleteSubscription}
                />
              )}
            </div>
          </div>
        )}
      </section>

      {data ? (
        <>
          <InstallmentSheet
            open={instSheetOpen}
            onOpenChange={setInstSheetOpen}
            data={data}
            today={today}
            initial={editingInst}
          />
          <SubscriptionSheet
            open={subSheetOpen}
            onOpenChange={setSubSheetOpen}
            data={data}
            initial={editingSub}
          />
        </>
      ) : null}
    </>
  );
}
