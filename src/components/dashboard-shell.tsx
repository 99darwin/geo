'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  const navItems = clientId
    ? [...getClientNavItems(clientId), { href: '/dashboard/settings', label: 'Settings' }]
    : TOP_NAV_ITEMS;

  return (
    <div className="flex min-h-screen">
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center px-6 border-b border-gray-100">
            <Link href="/" className="flex items-center">
              <Image
                src="/wordmark.png"
                alt="LookGEO"
                width={926}
                height={196}
                className="h-6 w-auto"
              />
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
                  aria-current={isActive ? 'page' : undefined}
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
        <header className="relative flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center md:hidden">
            <Image
              src="/wordmark.png"
              alt="LookGEO"
              width={926}
              height={196}
              className="h-6 w-auto"
            />
          </Link>

          <div className="hidden md:block">
            <span className="text-sm text-gray-700">{userName}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Hamburger button — mobile only */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 md:hidden"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              <span className="sr-only">
                {isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              </span>
              {isMobileMenuOpen ? (
                /* X icon */
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>

            {/* Desktop sign out */}
            <Button
              variant="secondary"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Log Out
            </Button>
          </div>

          {/* Mobile dropdown menu */}
          {isMobileMenuOpen && (
            <nav
              id="mobile-menu"
              aria-label="Mobile navigation"
              className="absolute right-0 top-16 z-40 w-56 rounded-bl-lg border-b border-l border-gray-200 bg-white py-2 shadow-lg md:hidden"
            >
              {clientId && (
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-600"
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
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-4 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    signOut({ callbackUrl: '/login' });
                  }}
                  className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Log Out
                </button>
              </div>
            </nav>
          )}
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}
