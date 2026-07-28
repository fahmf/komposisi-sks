import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useStore } from '../store/appStore';
import { AuroraBackdrop } from '@/components/ui/animated-background';
import {
  IconBolt,
  IconBook,
  IconDashboard,
  IconDownload,
  IconGrid,
  IconLayers,
  IconMoon,
  IconSettings,
  IconSun,
  IconUsers,
} from './icons';

const NAV = [
  { to: '/', label: 'Beranda', icon: IconDashboard, end: true },
  { to: '/plan', label: 'Pembagian', icon: IconBolt },
  { to: '/teachers', label: 'Pengajar', icon: IconUsers },
  { to: '/classes', label: 'Kelas', icon: IconGrid },
  { to: '/subjects', label: 'Kurikulum', icon: IconBook },
  { to: '/compare', label: 'Komparasi', icon: IconLayers },
  { to: '/export', label: 'Ekspor', icon: IconDownload },
  { to: '/settings', label: 'Pengaturan', icon: IconSettings },
];

// Primary items shown on the mobile bottom bar.
const MOBILE = ['/', '/plan', '/teachers', '/classes', '/export'];

export default function NavShell({ children }: { children: ReactNode }) {
  const theme = useStore((s) => s.ui.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const location = useLocation();

  return (
    <div className="min-h-screen lg:flex">
      <AuroraBackdrop />

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white/60 px-3 py-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-pop">
            <IconLayers width={18} height={18} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight tracking-tight">Komposisi SKS</p>
            <p className="text-[11px] text-slate-400">Pembagian Pengajar</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-brand-50 text-brand-700 shadow-soft before:absolute before:left-0 before:top-1/2 before:h-5 before:-translate-y-1/2 before:w-1 before:rounded-full before:bg-brand-500 before:content-[''] dark:bg-brand-900/40 dark:text-brand-200"
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`
              }
            >
              <item.icon width={18} height={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={toggleTheme} className="btn-ghost mt-2 justify-start">
          {theme === 'light' ? <IconMoon width={18} height={18} /> : <IconSun width={18} height={18} />}
          {theme === 'light' ? 'Mode gelap' : 'Mode terang'}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-pop">
              <IconLayers width={16} height={16} />
            </div>
            <span className="text-sm font-bold tracking-tight">Komposisi SKS</span>
          </div>
          <button onClick={toggleTheme} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Ganti tema">
            {theme === 'light' ? <IconMoon width={18} height={18} /> : <IconSun width={18} height={18} />}
          </button>
        </header>

        <main key={location.pathname} className="mx-auto w-full max-w-5xl animate-fade-in-up px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-slate-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? 'bg-brand-100 dark:bg-brand-900/50' : ''
                  }`}
                >
                  <item.icon width={20} height={20} />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
