'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type { ScanResult } from '@/types';
import { ScanResults } from '@/components/scan-results';
import { Button } from '@/components/ui/button';

function ScanPageContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const url = searchParams.get('url');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('scanResult');
    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch {
        // Corrupted data — ignore
      }
    }
    setPersisted(sessionStorage.getItem('scanPersisted') === 'true');
    setHasChecked(true);
  }, []);

  if (!hasChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold text-gray-900">No Scan Results</h1>
        <p className="mt-2 text-gray-600">
          Run a free scan first to see your AI visibility report.
        </p>
        <Link href="/" className="mt-6">
          <Button>Scan Your Website</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {url && (
          <p className="mb-2 text-center text-sm text-gray-500">
            Results for {url}
          </p>
        )}

        <ScanResults result={result} />

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-indigo-600 p-8 text-center text-white">
          <h2 className="text-2xl font-bold">
            {session ? 'View Your Dashboard' : 'Want Continuous AI Monitoring?'}
          </h2>
          <p className="mt-2 text-indigo-100">
            {session && persisted
              ? 'Your scan results have been saved. Check your full visibility report.'
              : 'Get monthly reports, AI-optimized files, competitor tracking, and more.'}
          </p>
          <Link href={session ? `/onboarding${url ? `?url=${encodeURIComponent(url)}` : ''}` : '/login'} className="mt-6 inline-block">
            <Button
              variant="secondary"
              size="lg"
              className="bg-white text-indigo-600 hover:bg-indigo-50 border-transparent"
            >
              {session ? 'Go to Dashboard' : 'Get Full Monitoring'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <ScanPageContent />
    </Suspense>
  );
}
