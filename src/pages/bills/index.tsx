import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { useFinanceData } from '../../hooks/useFinance';
import type { ISODate, Installment, Subscription } from '../../types/finance';
import { BillsTab } from './BillsTab';
import { InstallmentSheet } from './InstallmentSheet';
import { InstallmentsTab } from './InstallmentsTab';
import { SubscriptionSheet } from './SubscriptionSheet';
import { SubscriptionsTab } from './SubscriptionsTab';
import { todayBangkok } from './billsLogic';

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
  const { data, isLoading, error } = useFinanceData();
  const [segment, setSegment] = useState<BillsSegment>('bills');
  const [instSheetOpen, setInstSheetOpen] = useState(false);
  const [editingInst, setEditingInst] = useState<Installment | undefined>(undefined);
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | undefined>(undefined);

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
    <main className="px-screen pb-6 pt-5">
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
          <Card>
            <EmptyState message="โหลดข้อมูลบิลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" />
          </Card>
        ) : !data ? (
          <Card>
            <EmptyState message="ยังไม่มีข้อมูลบิลและรายการผ่อน" />
          </Card>
        ) : segment === 'bills' ? (
          <BillsTab data={data} today={today} />
        ) : segment === 'installments' ? (
          <InstallmentsTab data={data} today={today} onEdit={openEditInstallment} />
        ) : (
          <SubscriptionsTab data={data} onEdit={openEditSubscription} />
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
    </main>
  );
}
