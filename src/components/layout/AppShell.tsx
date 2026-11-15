import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { SideNav } from './SideNav';
import { TabBar } from './TabBar';

export interface AppShellProps {
  children?: ReactNode;
}

/**
 * Responsive shell (SPEC §3.3): centered phone/tablet column with bottom `TabBar` below 1024px,
 * or sticky `SideNav` + wide scrollable `<main>` at desktop widths. Only one nav is mounted at a time.
 */
export function AppShell({ children }: AppShellProps) {
  const isDesktop = useIsDesktop();
  const content = children ?? <Outlet />;

  if (isDesktop) {
    return (
      <div className="flex h-dvh w-full bg-ground">
        <SideNav />
        <main className="flex-1 overflow-y-auto px-screen pb-8 pt-6 lg:px-8">
          <div className="mx-auto w-full max-w-content">{content}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-phone flex-col bg-ground md:max-w-tablet">
      <main className="flex-1 overflow-y-auto px-screen pb-6 pt-5">{content}</main>
      <TabBar />
    </div>
  );
}
