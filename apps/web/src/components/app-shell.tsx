'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { API_URL, api, json } from '@/lib/api';
import { useNotifications, useUser } from '@/hooks/use-trackr';
import { relativeDate } from '@/lib/utils';
import { Button } from './ui/button';
import { Loading } from './states';
const navigation = [
  { href: '/app', label: 'Overview', icon: LayoutDashboard },
  { href: '/app/board', label: 'Application board', icon: LayoutGrid },
  { href: '/app/jobs', label: 'Saved jobs', icon: BriefcaseBusiness },
  { href: '/app/cvs', label: 'My CVs', icon: FileText },
];
export function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7.5h13M12 3l5 4.5-5 4.5M20 16.5H7M12 12l-5 4.5 5 4.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      trackr<span className="logo-dot">.</span>
    </Link>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const user = useUser();
  const notifications = useNotifications();
  const client = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [mobile, setMobile] = useState(false);
  const [bell, setBell] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  // The private workspace renders after hydration so a fast shared query cannot
  // update a nested Suspense boundary before its server markup is hydrated.
  useEffect(() => setMounted(true), []);
  const current =
    navigation.find((n) => n.href === path)?.label ||
    (path.startsWith('/admin') ? 'Admin dashboard' : 'Settings & billing');
  useEffect(() => {
    if (!user.data) return;
    const socket = io(API_URL.replace(/\/api$/, ''), { withCredentials: true });
    socket.on('notification', (notification: { title: string }) => {
      toast(notification.title, { icon: <Sparkles size={16} /> });
      for (const key of ['notifications', 'resumes', 'ai', 'applications'])
        void client.invalidateQueries({ queryKey: [key] });
    });
    socket.on('disconnect', (reason: string) => {
      if (reason === 'io server disconnect')
        void api('/auth/me')
          .then(() => socket.connect())
          .catch(() => undefined);
    });
    return () => {
      socket.disconnect();
    };
  }, [user.data?.id, client]);
  async function logout() {
    try {
      await api('/auth/logout', json('POST'));
      client.clear();
      router.push('/login');
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  const unread = notifications.data?.filter((n) => !n.readAt).length || 0;
  if (!mounted)
    return (
      <main className="page-content">
        <Loading />
      </main>
    );
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="mobile-shade"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <div className="sidebar-logo">
          <Logo />
          <button
            className="mobile-close"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-picker">
          <span className="workspace-icon">{user.data?.name?.[0] || 'Y'}</span>
          <div>
            <strong>Personal workspace</strong>
            <small>Your next chapter</small>
          </div>
          <ChevronsUpDown size={14} />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {navigation.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMobile(false)}
              className={`nav-link ${path === n.href ? 'active' : ''}`}
            >
              <n.icon size={19} />
              {n.label}
              {path === n.href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        <Link
          href="/app/settings/billing"
          className={`nav-link ${path.includes('settings') ? 'active' : ''}`}
        >
          <Settings2 size={19} />
          Settings
        </Link>
        {user.data?.role === 'ADMIN' && (
          <Link href="/admin" className="nav-link">
            <Shield size={19} />
            Admin dashboard
          </Link>
        )}
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <span className="upgrade-icon">
              <Sparkles size={18} />
            </span>
            <strong>A little extra edge.</strong>
            <p>
              More insights. More confidence.
              <br />
              Make your next move with Pro.
            </p>
            <Link href="/app/settings/billing">
              Explore Trackr Pro <ArrowUpRight size={16} />
            </Link>
          </div>
          <Link className="nav-link help-link" href="/app/settings">
            <CircleHelp size={18} />
            Help & getting started <ArrowUpRight size={14} />
          </Link>
          <div className="user-profile">
            <span className="avatar">
              {user.data?.name
                ?.split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('') || '…'}
            </span>
            <div>
              <strong>{user.data?.name || 'Your account'}</strong>
              <small>{user.data?.plan === 'PRO' ? 'Pro plan' : 'Free plan'}</small>
            </div>
            <button aria-label="Sign out" title="Sign out" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/app/jobs?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search saved jobs"
                placeholder="Search anything…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="notification-wrap">
              <button
                className="icon-button"
                aria-label={`Notifications, ${unread} unread`}
                aria-expanded={bell}
                onClick={() => setBell(!bell)}
              >
                <Bell size={19} />
                {unread > 0 && <i className="unread-dot" />}
              </button>
              {bell && (
                <div className="notification-panel">
                  <h3>
                    Notifications <span>{unread} new</span>
                  </h3>
                  {notifications.isError ? (
                    <p>Could not load notifications.</p>
                  ) : !notifications.data?.length ? (
                    <p>You’re all caught up. Updates will appear here.</p>
                  ) : (
                    notifications.data.map((n) => (
                      <button
                        key={n.id}
                        className={n.readAt ? '' : 'unread'}
                        onClick={async () => {
                          await api(`/notifications/${n.id}/read`, json('PATCH'));
                          void client.invalidateQueries({ queryKey: ['notifications'] });
                        }}
                      >
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                        <small>{relativeDate(n.createdAt)}</small>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <span className="topbar-avatar">{user.data?.name?.[0] || 'T'}</span>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="app-footer">
          <span>One step closer to your next chapter.</span>
          <span>
            Made for your momentum <span className="purple">✦</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function AddApplicationLink() {
  return (
    <Button asChild>
      <Link href="/app/jobs?new=1">
        <Plus size={17} />
        Add application
      </Link>
    </Button>
  );
}
export function PeriodLabel() {
  return (
    <span className="period-label">
      Last 8 weeks <ChevronDown size={14} />
    </span>
  );
}
