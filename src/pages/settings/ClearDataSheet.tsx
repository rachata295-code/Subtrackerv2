import { useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import { notify } from '../../components/ui/Toaster';
import { useClearAllData } from '../../hooks/useFinance';
import type { FinanceData } from '../../types/finance';

export interface ClearDataSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  onCleared: () => void;
}

const CONFIRM_KEYWORD = 'ล้างข้อมูล';

function ClearDataForm({
  data,
  onCleared,
}: {
  data: FinanceData;
  onCleared: () => void;
}) {
  const clearAllData = useClearAllData();
  const [includeSetup, setIncludeSetup] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const dataItems = [
    { label: 'รายการรับ-จ่าย', count: data.transactions.length },
    { label: 'ประวัติจ่ายบิล', count: data.payments.length },
    { label: 'ประวัติเช็กยอด', count: data.balanceChecks.length },
    { label: 'แผนรอบนี้', count: data.planItems.length },
    { label: 'สมาชิก', count: data.subscriptions.length },
    { label: 'รายการผ่อน', count: data.installments.length },
  ];
  const dataTotal = dataItems.reduce((sum, item) => sum + item.count, 0);

  const setupItems = [
    { label: 'เงินประจำ', count: data.recurringIncomes.length },
    { label: 'ก้อนเงิน (สร้างค่าเริ่มต้นใหม่)', count: data.pots.length },
    { label: 'ช่องทางจ่าย (สร้างค่าเริ่มต้นใหม่)', count: data.sources.length },
  ];
  const setupTotal = setupItems.reduce((sum, item) => sum + item.count, 0);
  const totalCount = includeSetup ? dataTotal + setupTotal : dataTotal;

  const isConfirmed = confirmText.trim() === CONFIRM_KEYWORD;

  const handleConfirm = async () => {
    if (!isConfirmed || clearAllData.isPending) return;
    try {
      await clearAllData.mutateAsync({ includeSetup });
      notify('ล้างข้อมูลแล้ว');
      onCleared();
    } catch (err) {
      const message = err instanceof Error && err.message.trim() ? err.message : 'ล้างข้อมูลไม่สำเร็จ';
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="rounded-tile border border-negative bg-surface p-3 text-sm">
        <p className="font-semibold text-negative">คำเตือน: ข้อมูลที่ลบไปแล้วจะกู้คืนไม่ได้</p>
        <p className="mt-1 text-text">
          รายการที่จะถูกลบทั้งหมด <span className="font-semibold tabular-nums">{totalCount}</span> รายการ:
        </p>
        <ul className="mt-2 space-y-1 text-muted">
          {dataItems.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span>{item.label}</span>
              <span className="tabular-nums text-text">{item.count} รายการ</span>
            </li>
          ))}
          {includeSetup ? (
            <>
              {setupItems.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-2">
                  <span>{item.label}</span>
                  <span className="tabular-nums text-text">{item.count} รายการ</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2">
                <span>เงินเดือนและวันรับเงิน</span>
                <span className="text-text">รีเซ็ตเป็นค่าเริ่มต้น</span>
              </li>
            </>
          ) : null}
        </ul>
      </div>

      <Switch
        label="ล้างการตั้งค่าด้วย (ช่องทาง ก้อนเงิน เงินประจำ รายได้)"
        checked={includeSetup}
        onChange={setIncludeSetup}
        disabled={clearAllData.isPending}
      />

      <TextField
        label={`พิมพ์คำว่า ${CONFIRM_KEYWORD} เพื่อยืนยัน`}
        placeholder={CONFIRM_KEYWORD}
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoComplete="off"
        disabled={clearAllData.isPending}
      />

      {clearAllData.isPending ? (
        <Button variant="danger" size="lg" className="w-full" loading>
          กำลังล้างข้อมูล…
        </Button>
      ) : isConfirmed ? (
        // Stop pointer events from bubbling to Vaul's drawer drag handler during the 1.2s hold.
        <div
          data-vaul-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <HoldToDelete label="กดค้างเพื่อล้างข้อมูล" onConfirm={() => void handleConfirm()} />
        </div>
      ) : (
        <Button variant="danger" size="lg" className="w-full" disabled>
          กดค้างเพื่อล้างข้อมูล
        </Button>
      )}
    </div>
  );
}

export function ClearDataSheet({ open, onOpenChange, data, onCleared }: ClearDataSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="ล้างข้อมูลทั้งหมด">
      {open ? <ClearDataForm data={data} onCleared={onCleared} /> : null}
    </BottomSheet>
  );
}
