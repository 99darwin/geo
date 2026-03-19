'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FEATURES = [
  'AI-optimized llms.txt file hosted for your site',
  'JSON-LD structured data schema',
  'Monthly citation monitoring across ChatGPT, Perplexity, Gemini',
  'Competitor visibility tracking',
  'NAP consistency audit across directories',
  'Monthly visibility reports',
];

function OnboardingContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [url, setUrl] = useState(searchParams.get('url') || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/onboarding${url ? `?url=${encodeURIComponent(url)}` : ''}`);
    }
  }, [status, router, url]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!url) {
      setError('Please enter your business website URL.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start checkout.');
        return;
      }

      if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setError('Failed to create checkout session.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            GEO
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Get Continuous AI Monitoring
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Make your business visible to AI search engines and stay there.
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              What you get
            </h2>
            <ul className="mt-3 space-y-2">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="mb-4 text-center">
              <span className="text-3xl font-bold text-gray-900">$299</span>
              <span className="text-gray-500 ml-1">setup</span>
              <span className="text-gray-400 mx-2">+</span>
              <span className="text-3xl font-bold text-gray-900">$49</span>
              <span className="text-gray-500 ml-1">/month</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Your business website"
                type="url"
                placeholder="https://yourbusiness.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoading}
              >
                Start Setup — $299 + $49/mo
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Secure checkout powered by Stripe.{' '}
          <Link href="/" className="text-indigo-600 hover:text-indigo-500">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
