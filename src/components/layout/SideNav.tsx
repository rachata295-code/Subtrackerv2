import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeSwitch } from '../ThemeSwitch';
import { Button } from '../ui/Button';
import { ITEMS } from './navItems';

/**
 * Desktop sidebar navigation (SPEC §3.3): pairs with `<AppShell>` at >=1024px so desktop users
 * have persistent navigation, a quick-add shortcut, and the theme switch without duplicating TabBar.
 */
export function SideNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="sticky top-0 flex h-dvh w-sidebar shrink-0 flex-col gap-5 border-r border-border bg-surface px-4 py-5">
      <div className="flex flex-col gap-4">
        <div className="px-2 text-section font-semibold text-text">SubTracker</div>
        <Button variant="primary" size="md" className="w-full" onClick={() => navigate('/?add=1')}>
          + เพิ่มรายการ
        </Button>
      </div>

      <nav aria-label="เมนูหลัก" className="flex flex-1 flex-col gap-1">
        {ITEMS.map(({ to, label, Icon }) => {
          const active = to === pathname;
          return (
            // Colour only on route change: tab switches happen constantly, so no motion.
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex h-11 min-h-tap items-center gap-3 rounded-tile px-3 text-sm font-medium',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2',
                active ? 'bg-raised text-text' : 'text-muted hover-fine:hover:bg-raised hover-fine:hover:text-text',
              ].join(' ')}
            >
              <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-rule pt-4">
        <ThemeSwitch />
      </div>
    </aside>
  );
}
