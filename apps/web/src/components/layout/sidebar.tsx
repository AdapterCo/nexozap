'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Scissors,
  Users,
  MessageCircle,
  MessagesSquare,
  GitBranch,
  Brain,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react';
import useAuthStore from '@/stores/auth-store';
import useUIStore from '@/stores/ui-store';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Agenda', icon: Calendar, href: '/agenda' },
  { label: 'Serviços', icon: Scissors, href: '/servicos' },
  { label: 'Profissionais', icon: Users, href: '/profissionais' },
  { label: 'WhatsApp', icon: MessageCircle, href: '/whatsapp' },
  { label: 'Conversas', icon: MessagesSquare, href: '/conversas' },
  { label: 'Fluxos', icon: GitBranch, href: '/fluxos' },
  { label: 'Config. IA', icon: Brain, href: '/ia-config' },
  { label: 'Relatórios', icon: BarChart3, href: '/relatorios' },
  { label: 'Configurações', icon: Settings, href: '/configuracoes' },
];

interface SidebarProps {
  collapsed?: boolean;
}

export default function Sidebar({ collapsed: collapsedProp }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const collapsed = collapsedProp ?? sidebarCollapsed;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-primary-900 text-white flex flex-col transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-primary-700/50">
        {!collapsed && (
          <span className="text-xl font-bold tracking-tight">NexoZap</span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-primary-700/50 transition-colors"
        >
          {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-primary-500 text-white'
                  : 'text-primary-100 hover:bg-primary-700/50 hover:text-white',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-primary-700/50 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-primary-300 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-primary-200 hover:bg-primary-700/50 hover:text-white transition-colors',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
