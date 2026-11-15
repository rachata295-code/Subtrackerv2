import { Link, useLocation } from 'react-router-dom';
import { House, List, Receipt, Settings, type LucideIcon } from 'lucide-react';

interface TabItem {
  to: string;
  label: string;
  Icon: LucideIcon;
}

// Only Overview exists in this phase; the other three share /design until their screens are built (phase 1).
const ITEMS: TabItem[] = [
  { to: '/preview-home', label: 'ภาพรวม', Icon: House },
  { to: '/design', label: 'รายการ', Icon: List },
  { to: '/design', label: 'บิล & ผ่อน', Icon: Receipt },
  { to: '/design', label: 'ตั้งค่า', Icon: Settings },
];

export function TabBar() {
  const { pathname } = useLocation();
  // Several tabs temporarily share a path, so NavLink would mark all of them current. Pick the first match instead.
  const activeIndex = ITEMS.findIndex((item) => item.to === pathname);

  return (
    <nav
      aria-label="เมนูหลัก"
      // sticky + bottom-0 inside a full-height flex column pins it to the viewport bottom without covering content.
      // Height here (8px top + 44px row) must stay in sync with --tabbar-h in tokens.css (the toaster offsets by it).
      className="sticky bottom-0 flex border-t border-border bg-surface pt-2"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {ITEMS.map(({ to, label, Icon }, i) => {
        const active = i === activeIndex;
        return (
          // Colour is the only thing that changes between tabs: tab switches happen constantly, so no motion.
          <Link
            key={label}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex h-11 min-w-tap flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2',
              active ? 'text-text' : 'text-muted hover-fine:hover:text-text',
            ].join(' ')}
          >
            <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
