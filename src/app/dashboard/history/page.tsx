'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Citation {
  id: string;
  platform: string;
  cited: boolean;
  position: number | null;
  queryText: string;
  checkedAt: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  gemini: 'Gemini',
  copilot: 'Copilot',
};

const PLATFORMS = ['', 'chatgpt', 'perplexity', 'google_ai', 'gemini', 'copilot'];

export default function HistoryPage() {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);

    fetch(`/api/dashboard/history?${params}`)
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const json = await res.json();
        const data = json.data as { citations: Citation[]; nextCursor: string | null; total: number };
        setCitations(data.citations);
        setNextCursor(data.nextCursor);
        setTotal(data.total);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [platform]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);

    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    params.set('cursor', nextCursor);

    try {
      const res = await fetch(`/api/dashboard/history?${params}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data as { citations: Citation[]; nextCursor: string | null; total: number };
        setCitations((prev) => [...prev, ...data.citations]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Citation History</h1>
          <p className="mt-1 text-gray-500">
            {total} total citation{total !== 1 ? 's' : ''}
          </p>
        </div>

        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All platforms</option>
          {PLATFORMS.filter(Boolean).map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <Card className="mt-6">
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded bg-gray-100" />
            ))}
          </div>
        ) : citations.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No citations found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="pb-3 font-medium">Query</th>
                    <th className="pb-3 font-medium">Platform</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Position</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {citations.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 pr-4 text-gray-900 max-w-[240px] truncate">
                        {c.queryText}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {PLATFORM_LABELS[c.platform] ?? c.platform}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.cited
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {c.cited ? 'Cited' : 'Not cited'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {c.position ?? '-'}
                      </td>
                      <td className="py-3 text-gray-400 text-xs">
                        {new Date(c.checkedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
