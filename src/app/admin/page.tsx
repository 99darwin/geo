'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PLAN_LABELS } from '@/lib/admin-constants';

interface StatsData {
  totalClients: number;
  activeSubscriptions: number;
  avgScore: number | null;
  pendingSetup: number;
  recentClients: {
    id: string;
    businessName: string;
    city: string | null;
    plan: string;
    createdAt: string;
  }[];
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStats = useCallback(() => {
    setError(false);
    setLoading(true);
    fetch('/api/admin/stats')
      .then(async (res) => {
        if (!res.ok) {
          setError(true);
          return;
        }
        const json = await res.json();
        setStats(json.data);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <div className="py-8 text-center">
            <p className="text-gray-500">Failed to load admin stats.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={loadStats}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-gray-500">Total Clients</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {stats.totalClients}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500">Active Subscriptions</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {stats.activeSubscriptions}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500">Avg Visibility Score</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {stats.avgScore !== null ? Math.round(stats.avgScore) : '--'}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500">Pending Setup</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">
            {stats.pendingSetup}
          </p>
        </Card>
      </div>

      <Card className="mt-8" title="Recent Clients">
        {stats.recentClients.length === 0 ? (
          <p className="text-gray-500">No clients yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-3 font-medium">Business</th>
                  <th className="pb-3 font-medium">City</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentClients.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        {c.businessName}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{c.city}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {PLAN_LABELS[c.plan] ?? c.plan}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
