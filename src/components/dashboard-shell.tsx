'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

const TOP_NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/settings', label: 'Settings' },
];

function getClientNavItems(clientId: string) {
  return [
    { href: `/dashboard/${clientId}`, label: 'Overview' },
    { href: `/dashboard/${clientId}/reports`, label: 'Reports' },
    { href: `/dashboard/${clientId}/history`, label: 'History' },
  ];
}

// Extract clientId from pathname if present (e.g., /dashboard/uuid/reports → uuid)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractClientId(pathname: string): string | null {
  const segments = pathname.split('/');
  // /dashboard/[clientId]/...
  if (segments.length >= 3 && segments[1] === 'dashboard' && UUID_RE.test(segments[2])) {
    return segments[2];
  }
  return null;
}

interface DashboardShellProps {
  userName: string;
  children: React.ReactNode;
}

export function DashboardShell({ userName, children }: DashboardShellProps) {
  const pathname = usePathname();
  const clientId = extractClientId(pathname);

  const navItems = clientId
    ? [...getClientNavItems(clientId), { href: '/dashboard/settings', label: 'Settings' }]
    : TOP_NAV_ITEMS;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center px-6 border-b border-gray-100">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              GEO
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {clientId && (
              <Link
                href="/dashboard"
                className="flex items-center rounded-lg px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 mb-2"
              >
                &larr; All Businesses
              </Link>
            )}
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          {/* Mobile logo */}
          <Link
            href="/"
            className="text-xl font-bold text-indigo-600 md:hidden"
          >
            GEO
          </Link>

          <div className="hidden md:block">
            <span className="text-sm text-gray-700">{userName}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Mobile nav */}
            <nav className="flex gap-2 md:hidden">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Log Out
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}
