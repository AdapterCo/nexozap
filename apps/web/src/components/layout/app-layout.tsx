'use client';

import { ReactNode } from 'react';
import Sidebar from './sidebar';
import Header from './header';
import useUIStore from '@/stores/ui-store';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  headerTitle: string;
}

export default function AppLayout({ children, headerTitle }: AppLayoutProps) {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300',
          sidebarCollapsed ? 'ml-[68px]' : 'ml-64'
        )}
      >
        <Header title={headerTitle} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
