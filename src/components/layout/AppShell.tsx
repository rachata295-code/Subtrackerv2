import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';

export interface AppShellProps {
  children?: ReactNode;
}

/**
 * Full-height 480px centred phone column: only `<main>` scrolls while `TabBar` stays sticky at the bottom.
 * Page headers belong in each screen, and `<AppToaster />` is already mounted once at the root in `App.tsx`.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-phone flex-col bg-ground">
      <main className="flex-1 overflow-y-auto px-screen pb-6 pt-5">{children ?? <Outlet />}</main>
      <TabBar />
    </div>
  );
}
