'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 300000; // 5 minutes — pipeline can take a while
const MAX_CONSECUTIVE_ERRORS = 5;

export default function OnboardingSuccessPage() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [status, setStatus] = useState<string>('waiting');

  useEffect(() => {
    const start = Date.now();
    let cancelled = false;
    let consecutiveErrors = 0;

    async function poll() {
      if (cancelled) return;

      try {
        const res = await fetch('/api/dashboard');

        // No client record exists — user landed here without completing checkout
        if (res.status === 404) {
          router.push('/dashboard');
          return;
        }

        // Auth error — redirect to login
        if (res.status === 401) {
          router.push('/login?callbackUrl=/onboarding/success');
          return;
        }

        if (res.ok) {
          consecutiveErrors = 0;
          const data = await res.json();
          const onboardingStatus = data.data?.client?.onboardingStatus;

          if (onboardingStatus === 'setup_complete' || onboardingStatus === 'active') {
            router.push('/dashboard');
            return;
          }

          // Update display status for user feedback
          if (onboardingStatus === 'setup_running') {
            setStatus('running');
          } else if (onboardingStatus === 'setup_pending') {
            setStatus('pending');
          }
        } else {
          // Non-2xx, non-404, non-401 — count as error
          consecutiveErrors++;
        }
      } catch {
        // Network error — count toward threshold
        consecutiveErrors++;
      }

      // Too many consecutive errors — show timeout/fallback
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        setTimedOut(true);
        return;
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

  const statusMessage = status === 'running'
    ? "We're analyzing your website and checking AI visibility across platforms. This usually takes a few minutes."
    : "We're processing your payment and setting up AI monitoring.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="text-2xl font-bold text-indigo-600">
          GEO
        </Link>

        {timedOut ? (
          <div className="mt-8">
            <h1 className="text-xl font-bold text-gray-900">
              Still Working
            </h1>
            <p className="mt-3 text-sm text-gray-600">
              Setup is taking longer than usual. Your dashboard will be ready soon.
              You can check back or go to the dashboard now.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={() => {
                  setTimedOut(false);
                  window.location.reload();
                }}
              >
                Check Again
              </Button>
              <Button onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <h1 className="mt-6 text-xl font-bold text-gray-900">
              Setting Up Your Account
            </h1>
            <p className="mt-3 text-sm text-gray-600">
              {statusMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
