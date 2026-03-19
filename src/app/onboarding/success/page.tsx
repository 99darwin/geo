'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 60000;

export default function OnboardingSuccessPage() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const start = Date.now();
    let cancelled = false;

    async function poll() {
      if (cancelled) return;

      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          if (data.data?.client) {
            router.push('/dashboard');
            return;
          }
        }
      } catch {
        // Network error — keep polling
      }

      if (Date.now() - start > MAX_POLL_DURATION_MS) {
        setTimedOut(true);
        return;
      }

      if (!cancelled) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-2xl font-bold text-indigo-600">
          GEO
        </Link>

        {timedOut ? (
          <div className="mt-8">
            <h1 className="text-xl font-bold text-gray-900">
              Processing Your Payment
            </h1>
            <p className="mt-3 text-sm text-gray-600">
              Your payment is being processed. This can take a moment.
              Your dashboard will be ready shortly.
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                setTimedOut(false);
                window.location.reload();
              }}
            >
              Check Again
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <h1 className="mt-6 text-xl font-bold text-gray-900">
              Setting Up Your Account
            </h1>
            <p className="mt-3 text-sm text-gray-600">
              We&apos;re analyzing your website and setting up AI monitoring.
              This usually takes a minute or two.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
