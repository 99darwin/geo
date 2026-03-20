'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ui/score-gauge';

interface ReportItem {
  id: string;
  url: string;
  score: number;
  createdAt: string;
}

export default function ClientReportsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    fetch(`/api/dashboard/reports?clientId=${clientId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError('Failed to load reports. Please refresh and try again.');
          return;
        }
        const json = await res.json();
        setReports(json.data.reports);
        setNextCursor(json.data.nextCursor);
      })
      .catch(() => {
        if (!cancelled) setError('Network error. Please check your connection.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  async function loadMore() {
    if (!nextCursor || !clientId) return;
    setLoadingMore(true);

    try {
      const res = await fetch(`/api/dashboard/reports?clientId=${clientId}&cursor=${nextCursor}`);
      if (res.ok) {
        const json = await res.json();
        setReports((prev) => [...prev, ...json.data.reports]);
        setNextCursor(json.data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/dashboard/${clientId}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        &larr; Back to Overview
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Scan Reports</h1>
      <p className="mt-1 text-gray-500">All past AI visibility scans for this business.</p>

      <Card className="mt-6">
        {error ? (
          <p className="py-8 text-center text-red-600">{error}</p>
        ) : loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded bg-gray-100" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No scan reports yet.
          </p>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/${clientId}/reports/${r.id}`}
                  className="flex items-center gap-4 py-4 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ScoreGauge score={r.score} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.url}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {r.score}/100
                  </span>
                </Link>
              ))}
            </div>
            {nextCursor && (
              <div className="mt-4 text-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadMore}
                  isLoading={loadingMore}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
