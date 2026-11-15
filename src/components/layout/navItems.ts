import { House, List, Receipt, Settings, Target, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

export const ITEMS: NavItem[] = [
  { to: '/', label: 'ภาพรวม', Icon: House },
  { to: '/entries', label: 'รายการ', Icon: List },
  { to: '/plan', label: 'แผน', Icon: Target },
  { to: '/bills', label: 'บิล & ผ่อน', Icon: Receipt },
  { to: '/settings', label: 'ตั้งค่า', Icon: Settings },
];
