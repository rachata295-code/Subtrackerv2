import { useState, type FormEvent } from 'react';
import { useOptionalAuth } from '../../auth';
import { ThemeSwitch } from '../../components/ThemeSwitch';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListRow } from '../../components/ui/ListRow';
import { Pill } from '../../components/ui/Pill';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { notify } from '../../components/ui/Toaster';
import { HUE_MARK } from '../../components/ui/hue';
import {
  useDeletePot,
  useDeleteSource,
  useFinanceData,
  useUpdateSettings,
  useUpsertPot,
  useUpsertSource,
} from '../../hooks/useFinance';
import type { PaymentSource, Pot, Settings, UpsertPotInput, UpsertSourceInput } from '../../types/finance';
import { PotSheet } from './PotSheet';
import { SourceSheet } from './SourceSheet';
import { formatSourceSummary, parseDayOfMonth } from './settingsUtils';

export interface SettingsPageProps {
  /** Optional signOut override for isolated tests; defaults to AuthProvider's signOut. */
  onSignOut?: () => void | Promise<void>;
}

function SalaryForm({
  settings,
  isPending,
  onSave,
}: {
  settings: Settings;
  isPending: boolean;
  onSave: (salarySatang: number, payDay: number) => Promise<void>;
}) {
  const [salary, setSalary] = useState<number | null>(settings.salary / 100);
  const [payDayText, setPayDayText] = useState<string>(String(settings.payDay));
  const [salaryError, setSalaryError] = useState<string>();
  const [payDayError, setPayDayError] = useState<string>();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (salary === null || salary <= 0) {
      setSalaryError('กรอกเงินเดือนให้ถูกต้อง');
      valid = false;
    }

    const parsedPayDay = parseDayOfMonth(payDayText);
    if (parsedPayDay === null) {
      setPayDayError('กรุณาระบุวันที่ 1–31');
      valid = false;
    }

    if (!valid) return;
    await onSave(Math.round(salary! * 100), parsedPayDay!);
  };

  return (
    <Card>
      <form noValidate className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <CurrencyField
          label="เงินเดือน"
          value={salary}
          error={salaryError}
          onChange={(v) => {
            setSalary(v);
            setSalaryError(undefined);
          }}
        />
        <TextField
          label="วันเงินเดือนเข้า"
          inputMode="numeric"
          placeholder="1–31"
          value={payDayText}
          error={payDayError}
          onChange={(e) => {
            setPayDayText(e.target.value);
            setPayDayError(undefined);
          }}
        />
        {/* Only primary button on the screen (SPEC / PLAN §5.1). */}
        <Button type="submit" variant="primary" size="lg" loading={isPending}>
          บันทึก
        </Button>
      </form>
    </Card>
  );
}

export default function SettingsPage({ onSignOut }: SettingsPageProps) {
  const auth = useOptionalAuth();
  const { data, isLoading, error, refetch } = useFinanceData();
  const updateSettings = useUpdateSettings();
  const upsertSource = useUpsertSource();
  const deleteSource = useDeleteSource();
  const upsertPot = useUpsertPot();
  const deletePot = useDeletePot();

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<PaymentSource | null>(null);
  const [potSheetOpen, setPotSheetOpen] = useState(false);
  const [editingPot, setEditingPot] = useState<Pot | null>(null);

  const handleSaveSalary = async (salary: number, payDay: number) => {
    await updateSettings.mutateAsync({ salary, payDay });
    notify('บันทึกการตั้งค่าแล้ว');
  };

  const handleSaveSource = async (input: UpsertSourceInput) => {
    await upsertSource.mutateAsync(input);
    setSourceSheetOpen(false);
    notify('บันทึกช่องทางจ่ายแล้ว');
  };

  const handleArchiveToggleSource = async (source: PaymentSource) => {
    const nextArchived = !source.archived;
    await upsertSource.mutateAsync({ ...source, archived: nextArchived });
    setSourceSheetOpen(false);
    notify(nextArchived ? 'เก็บถาวรช่องทางแล้ว' : 'นำช่องทางกลับมาใช้แล้ว');
  };

  const handleDeleteSource = async (sourceId: string) => {
    await deleteSource.mutateAsync(sourceId);
    setSourceSheetOpen(false);
    notify('ลบช่องทางแล้ว');
  };

  const handleSavePot = async (input: UpsertPotInput) => {
    await upsertPot.mutateAsync(input);
    setPotSheetOpen(false);
    notify('บันทึกก้อนเงินแล้ว');
  };

  const handleDeletePot = async (potId: string) => {
    await deletePot.mutateAsync(potId);
    setPotSheetOpen(false);
    notify('ลบก้อนเงินแล้ว');
  };

  const handleSignOut = async () => {
    const signOutFn = onSignOut ?? auth?.signOut;
    if (signOutFn) {
      await signOutFn();
    }
  };

  const activeSources = (data?.sources ?? []).filter((s) => !s.archived);
  const archivedSources = (data?.sources ?? []).filter((s) => s.archived);

  return (
    <>
      <h1 className="text-title font-semibold text-text">ตั้งค่า</h1>

      {isLoading ? (
        <div className="mt-4 space-y-3" role="status" aria-label="กำลังโหลด">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <Card className="mt-4 flex flex-col items-start gap-3" role="alert">
          <p className="text-sm text-negative">โหลดการตั้งค่าไม่สำเร็จ: {error.message}</p>
          {refetch ? (
            <Button variant="secondary" onClick={() => refetch()}>
              ลองใหม่
            </Button>
          ) : null}
        </Card>
      ) : data ? (
        <div className="mt-4 space-y-5">
          <section>
            <SectionHeader title="รายได้และรอบเงินเดือน" />
            <div className="mt-1">
              <SalaryForm
                key={`${data.settings.salary}-${data.settings.payDay}`}
                settings={data.settings}
                isPending={updateSettings.isPending}
                onSave={handleSaveSalary}
              />
            </div>
          </section>

          <section>
            <SectionHeader
              title="ช่องทางจ่าย"
              actionLabel="เพิ่มช่องทาง"
              onAction={() => {
                setEditingSource(null);
                setSourceSheetOpen(true);
              }}
            />
            <Card padding="none" className="mt-1 px-card py-1">
              {activeSources.length === 0 ? (
                <EmptyState message="ยังไม่มีช่องทางจ่าย" />
              ) : (
                activeSources.map((src) => (
                  <ListRow
                    key={src.id}
                    leading={<span aria-hidden="true" className={`block h-2.5 w-2.5 rounded-dot ${HUE_MARK[src.hue]}`} />}
                    title={src.name}
                    detail={formatSourceSummary(src, data.sources)}
                    amount={null}
                    onClick={() => {
                      setEditingSource(src);
                      setSourceSheetOpen(true);
                    }}
                  />
                ))
              )}
            </Card>

            {archivedSources.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1 px-1 text-sm text-muted">เก็บถาวรแล้ว</p>
                <Card padding="none" className="px-card py-1">
                  {archivedSources.map((src) => (
                    <ListRow
                      key={src.id}
                      leading={<Pill hue={src.hue}>เก็บถาวร</Pill>}
                      title={src.name}
                      detail={formatSourceSummary(src, data.sources)}
                      amount={null}
                      onClick={() => {
                        setEditingSource(src);
                        setSourceSheetOpen(true);
                      }}
                    />
                  ))}
                </Card>
              </div>
            ) : null}
          </section>

          <section>
            <SectionHeader
              title="ก้อนเงิน"
              actionLabel="เพิ่มก้อนเงิน"
              onAction={() => {
                setEditingPot(null);
                setPotSheetOpen(true);
              }}
            />
            <Card padding="none" className="mt-1 px-card py-1">
              {data.pots.length === 0 ? (
                <EmptyState message="ยังไม่มีก้อนเงิน" />
              ) : (
                data.pots.map((pot) => (
                  <ListRow
                    key={pot.id}
                    leading={<span aria-hidden="true" className={`block h-2.5 w-2.5 rounded-dot ${HUE_MARK[pot.hue]}`} />}
                    title={pot.name}
                    detail={pot.rollover ? 'ยกยอดคงเหลือไปรอบถัดไป' : 'ไม่ยกยอด'}
                    amount={pot.perPeriod / 100}
                    onClick={() => {
                      setEditingPot(pot);
                      setPotSheetOpen(true);
                    }}
                  />
                ))
              )}
            </Card>
          </section>

          <section>
            <SectionHeader title="ธีม" />
            <Card className="mt-1">
              <ThemeSwitch />
            </Card>
          </section>

          <section className="pt-1">
            <Button variant="secondary" size="lg" className="w-full" onClick={() => void handleSignOut()}>
              ออกจากระบบ
            </Button>
          </section>

          <SourceSheet
            open={sourceSheetOpen}
            onOpenChange={setSourceSheetOpen}
            data={data}
            editing={editingSource}
            onSave={handleSaveSource}
            onArchiveToggle={handleArchiveToggleSource}
            onDelete={handleDeleteSource}
            isSubmitting={upsertSource.isPending || deleteSource.isPending}
          />

          <PotSheet
            open={potSheetOpen}
            onOpenChange={setPotSheetOpen}
            data={data}
            editing={editingPot}
            onSave={handleSavePot}
            onDelete={handleDeletePot}
            isSubmitting={upsertPot.isPending || deletePot.isPending}
          />
        </div>
      ) : null}
    </>
  );
}
