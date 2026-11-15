'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { billingNotice, type Billing } from '@/lib/billing';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

const navItems: { href: string; label: string; icon: string; adminOnly?: boolean; superOnly?: boolean }[] = [
  { href: '/empresas', label: 'Empresas', icon: '🏢', superOnly: true },
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/clientes', label: 'Clientes', icon: '👥' },
  { href: '/pets', label: 'Pets', icon: '🐾' },
  { href: '/agenda', label: 'Agenda', icon: '📅' },
  { href: '/estoque', label: 'Estoque', icon: '📦' },
  { href: '/vendas', label: 'Vendas', icon: '💰' },
  { href: '/financeiro', label: 'Financeiro', icon: '💳', adminOnly: true },
  { href: '/relatorios', label: 'Relatórios', icon: '📊' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️', adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const router = useRouter();

  // situação da cobrança, atualizada ao abrir o app: o admin da empresa vê avisos de teste/vencimento
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ company?: { billing?: Billing | null } | null }>('/auth/me')).data,
    enabled: user?.role === 'ADMIN',
    refetchOnWindowFocus: true,
  });
  const notice = user?.role === 'ADMIN' ? billingNotice(me?.company?.billing) : null;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 lg:flex lg:flex-col`}
      >
        {user?.company?.logo ? (
          <div className="flex items-center justify-center border-b border-gray-100 bg-white py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.company.logo} alt={user.company.name} className="h-28 w-28 rounded-2xl object-cover" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 px-4 bg-primary-600">
            <h1 className="truncate text-white text-xl font-bold">🐾 {user?.company?.name ?? 'VetPet'}</h1>
          </div>
        )}
        <nav className="mt-4 px-2 flex-1 overflow-y-auto">
          {navItems.filter((item) => (user?.role === 'SUPER_ADMIN' ? item.superOnly : !item.superOnly && (!item.adminOnly || user?.role === 'ADMIN'))).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          {user?.company?.name ? `${user.company.name} · VetPet Manager` : 'VetPet Manager v1.0'}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-white shadow-sm flex items-center px-4 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs">
                {user?.name?.charAt(0).toUpperCase() ?? 'A'}
              </div>
              <span className="hidden sm:inline font-medium">{user?.name ?? 'Admin'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-red-500 hover:text-red-700 transition-colors px-2 py-1 rounded hover:bg-red-50"
            >
              Sair
            </button>
          </div>
        </header>
        {notice && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">⚠️ {notice}</div>
        )}
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
