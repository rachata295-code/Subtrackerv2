import { useMemo, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import type { Hue } from '../../components/ui/hue';
import type { FinanceData, PaymentSource, SourceKind, UpsertSourceInput } from '../../types/finance';
import { HueSwatches } from './HueSwatches';
import { hasLinkedRecords, parseDayOfMonth, pickAvailableHue } from './settingsUtils';

export interface SourceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  editing: PaymentSource | null;
  onSave: (input: UpsertSourceInput) => Promise<void>;
  onArchiveToggle: (source: PaymentSource) => Promise<void>;
  onDelete: (sourceId: string) => Promise<void>;
  isSubmitting?: boolean;
}

const KIND_OPTIONS: { value: SourceKind; label: string }[] = [
  { value: 'bank', label: 'บัญชี' },
  { value: 'credit_card', label: 'บัตรเครดิต' },
  { value: 'paylater', label: 'PayLater' },
];

const OFFSET_OPTIONS: { value: '0' | '1'; label: string }[] = [
  { value: '0', label: 'เดือนที่ปิดรอบ' },
  { value: '1', label: 'เดือนถัดไป' },
];

function SourceForm({
  data,
  editing,
  onSave,
  onArchiveToggle,
  onDelete,
  isSubmitting,
}: Omit<SourceSheetProps, 'open' | 'onOpenChange'>) {
  const usedHues = data.sources.filter((s) => s.id !== editing?.id && !s.archived).map((s) => s.hue);
  const bankSources = data.sources.filter((s) => s.kind === 'bank' && !s.archived && s.id !== editing?.id);
  const payFromOptions = useMemo(
    () => [{ value: '', label: 'ไม่ระบุ' }, ...bankSources.map((b) => ({ value: b.id, label: b.name }))],
    [bankSources],
  );

  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<SourceKind>(editing?.kind ?? 'bank');
  const [hue, setHue] = useState<Hue>(editing?.hue ?? pickAvailableHue(usedHues));
  const [closeDayText, setCloseDayText] = useState(
    editing?.statementCloseDay !== null && editing?.statementCloseDay !== undefined
      ? String(editing.statementCloseDay)
      : '',
  );
  const [dueDayText, setDueDayText] = useState(
    editing?.dueDay !== null && editing?.dueDay !== undefined ? String(editing.dueDay) : '',
  );
  const [dueMonthOffset, setDueMonthOffset] = useState<'0' | '1'>(
    editing?.dueMonthOffset === 1 ? '1' : '0',
  );
  const [payFromSourceId, setPayFromSourceId] = useState<string>(editing?.payFromSourceId ?? '');

  const [nameError, setNameError] = useState<string>();
  const [closeDayError, setCloseDayError] = useState<string>();
  const [dueDayError, setDueDayError] = useState<string>();

  const handleKindChange = (nextKind: SourceKind) => {
    setKind(nextKind);
    setCloseDayError(undefined);
    setDueDayError(undefined);
    if (!editing && nextKind !== 'bank') {
      if (nextKind === 'credit_card') {
        if (!closeDayText) setCloseDayText('10');
        if (!dueDayText) setDueDayText('24');
        setDueMonthOffset('0');
      } else {
        setCloseDayText('');
        if (!dueDayText) setDueDayText('10');
        setDueMonthOffset('1');
      }
      if (!payFromSourceId && bankSources[0]) {
        setPayFromSourceId(bankSources[0].id);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('กรอกชื่อช่องทาง');
      valid = false;
    }

    let statementCloseDay: number | null = null;
    let dueDay: number | null = null;
    let resolvedOffset: 0 | 1 | null = null;
    let resolvedPayFrom: string | null = null;

    if (kind !== 'bank') {
      if (closeDayText.trim() !== '') {
        const parsedClose = parseDayOfMonth(closeDayText);
        if (parsedClose === null) {
          setCloseDayError('กรุณาระบุวันที่ 1–31');
          valid = false;
        } else {
          statementCloseDay = parsedClose;
        }
      }

      const parsedDue = parseDayOfMonth(dueDayText);
      if (parsedDue === null) {
        setDueDayError('กรุณาระบุวันที่ 1–31');
        valid = false;
      } else {
        dueDay = parsedDue;
      }

      resolvedOffset = dueMonthOffset === '1' ? 1 : 0;
      resolvedPayFrom = payFromSourceId || null;
    }

    if (!valid) return;

    await onSave({
      ...(editing ? { id: editing.id } : {}),
      name: trimmedName,
      kind,
      hue,
      archived: editing?.archived ?? false,
      statementCloseDay,
      dueDay,
      dueMonthOffset: resolvedOffset,
      payFromSourceId: resolvedPayFrom,
    });
  };

  const linked = editing ? hasLinkedRecords(editing.id, data) : false;

  return (
    <form noValidate className="flex flex-col gap-4 pb-2" onSubmit={(e) => void handleSubmit(e)}>
      <TextField
        label="ชื่อช่องทาง"
        placeholder="เช่น บัตรเครดิต, กสิกร"
        value={name}
        error={nameError}
        onChange={(e) => {
          setName(e.target.value);
          setNameError(undefined);
        }}
      />

      <SegmentedControl label="ประเภทช่องทาง" options={KIND_OPTIONS} value={kind} onChange={handleKindChange} />

      <HueSwatches value={hue} usedHues={usedHues} onChange={setHue} />

      {/* Billing cycle fields do not apply to bank accounts because they settle immediately (SPEC §3). */}
      {kind !== 'bank' ? (
        <div className="flex flex-col gap-4 border-t border-rule pt-3">
          <TextField
            label="วันปิดรอบ (1–31)"
            inputMode="numeric"
            placeholder="ว่าง = ทั้งเดือนปฏิทิน"
            value={closeDayText}
            error={closeDayError}
            onChange={(e) => {
              setCloseDayText(e.target.value);
              setCloseDayError(undefined);
            }}
          />

          <TextField
            label="วันครบกำหนด (1–31)"
            inputMode="numeric"
            placeholder="เช่น 24"
            value={dueDayText}
            error={dueDayError}
            onChange={(e) => {
              setDueDayText(e.target.value);
              setDueDayError(undefined);
            }}
          />

          <SegmentedControl
            label="เดือนครบกำหนด"
            options={OFFSET_OPTIONS}
            value={dueMonthOffset}
            onChange={setDueMonthOffset}
          />

          <SelectField
            label="จ่ายจากบัญชี"
            options={payFromOptions}
            value={payFromSourceId}
            onChange={(e) => setPayFromSourceId(e.target.value)}
          />
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
        บันทึก
      </Button>

      {editing ? (
        editing.archived ? (
          <Button
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => {
              void onArchiveToggle(editing);
            }}
          >
            นำกลับมาใช้งาน
          </Button>
        ) : linked ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm text-muted">ช่องทางนี้มีรายการผูกอยู่ จึงเก็บถาวรแทนการลบ</p>
            <Button
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                void onArchiveToggle(editing);
              }}
            >
              เก็บถาวรช่องทาง
            </Button>
          </div>
        ) : (
          <HoldToDelete
            label="กดค้างเพื่อลบช่องทาง"
            onConfirm={() => {
              void onDelete(editing.id);
            }}
          />
        )
      ) : null}
    </form>
  );
}

export function SourceSheet({
  open,
  onOpenChange,
  data,
  editing,
  onSave,
  onArchiveToggle,
  onDelete,
  isSubmitting,
}: SourceSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={editing ? 'แก้ไขช่องทางจ่าย' : 'เพิ่มช่องทางจ่าย'}>
      {open ? (
        <SourceForm
          key={editing?.id ?? 'new-source'}
          data={data}
          editing={editing}
          onSave={onSave}
          onArchiveToggle={onArchiveToggle}
          onDelete={onDelete}
          isSubmitting={isSubmitting}
        />
      ) : null}
    </BottomSheet>
  );
}
