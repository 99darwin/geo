'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 300000; // 5 minutes
const MAX_CONSECUTIVE_ERRORS = 5;

export default function OnboardingSuccessPage() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [status, setStatus] = useState<string>('waiting');
  // Track client IDs that were already active/complete before polling started,
  // so we only redirect to the *new* client created by the current checkout.
  const initialClientIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const start = Date.now();
    let cancelled = false;
    let consecutiveErrors = 0;

    async function poll() {
      if (cancelled) return;

      try {
        // Poll the clients list to find the newly created client
        const res = await fetch('/api/dashboard/clients');

        if (res.status === 401) {
          router.push('/login?callbackUrl=/onboarding/success');
          return;
        }

        if (res.ok) {
          consecutiveErrors = 0;
          const json = await res.json();
          const clients = json.data?.clients ?? [];

          // On the first successful poll, snapshot IDs of already-completed clients
          if (initialClientIds.current === null) {
            initialClientIds.current = new Set(
              clients
                .filter(
                  (c: { onboardingStatus: string }) =>
                    c.onboardingStatus === 'setup_complete' || c.onboardingStatus === 'active'
                )
                .map((c: { id: string }) => c.id)
            );
          }

          // Find a client that's still being set up or just completed
          const settingUp = clients.find(
            (c: { onboardingStatus: string }) =>
              c.onboardingStatus === 'setup_pending' || c.onboardingStatus === 'setup_running'
          );
          // Only consider clients that weren't already complete when we started polling
          const justCompleted = clients.find(
            (c: { id: string; onboardingStatus: string }) =>
              !initialClientIds.current!.has(c.id) &&
              (c.onboardingStatus === 'setup_complete' || c.onboardingStatus === 'active')
          );

          if (settingUp) {
            setStatus(settingUp.onboardingStatus === 'setup_running' ? 'running' : 'pending');
          } else if (justCompleted) {
            // Setup finished — go to that client's dashboard
            router.push(`/dashboard/${justCompleted.id}`);
            return;
          } else if (clients.length === 0) {
            // No client yet — webhook hasn't fired
            setStatus('waiting');
          }
        } else {
          consecutiveErrors++;
        }
      } catch {
        consecutiveErrors++;
      }

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
