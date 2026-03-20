'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { ScanResult } from '@/types';
import { ScanResults } from '@/components/scan-results';
import { Card } from '@/components/ui/card';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    fetch(`/api/dashboard/reports/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          setError(res.status === 404 ? 'Report not found.' : 'Failed to load report.');
          return;
        }
        const json = await res.json();
        setResult(json.data);
      })
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="h-64 rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <p className="py-8 text-center text-red-600">{error || 'Report not found.'}</p>
          <div className="text-center pb-4">
            <Link href="/dashboard/reports" className="text-sm text-indigo-600 hover:underline">
              Back to Reports
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard/reports"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        &larr; Back to Reports
      </Link>

      <ScanResults result={result} />
    </div>
  );
}
