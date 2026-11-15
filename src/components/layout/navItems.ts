import { House, List, Receipt, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

export const ITEMS: NavItem[] = [
  { to: '/', label: 'ภาพรวม', Icon: House },
  { to: '/entries', label: 'รายการ', Icon: List },
  { to: '/bills', label: 'บิล & ผ่อน', Icon: Receipt },
  { to: '/settings', label: 'ตั้งค่า', Icon: Settings },
];
