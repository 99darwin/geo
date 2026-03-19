'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { ScanResult } from '@/types';
import { ScanResults } from '@/components/scan-results';
import { Button } from '@/components/ui/button';

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    fetch(`/api/reports/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to load report');
          return;
        }
        setResult(json.data);
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {error === 'This report has expired' ? 'Report Expired' : 'Report Not Found'}
        </h1>
        <p className="mt-2 text-gray-600">
          {error === 'This report has expired'
            ? 'This shared report has expired. Run a new scan to generate a fresh report.'
            : 'This report link is invalid or has been removed.'}
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
        <p className="mb-6 text-center text-sm text-gray-400">
          Shared AI Visibility Report
        </p>

        <ScanResults result={result} />

        <div className="mt-12 rounded-2xl bg-indigo-600 p-8 text-center text-white">
          <h2 className="text-2xl font-bold">
            Check Your Own AI Visibility
          </h2>
          <p className="mt-2 text-indigo-100">
            See how visible your business is to AI search engines like ChatGPT,
            Perplexity, and Google AI.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button
              variant="secondary"
              size="lg"
              className="bg-white text-indigo-600 hover:bg-indigo-50 border-transparent"
            >
              Run a Free Scan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
