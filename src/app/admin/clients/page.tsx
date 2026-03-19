'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ClientItem {
  id: string;
  businessName: string;
  city: string;
  state: string | null;
  plan: string;
  onboardingStatus: string;
  latestScore: number | null;
  createdAt: string;
}

const PLAN_LABELS: Record<string, string> = {
  free_scan: 'Free',
  starter: 'Starter',
  growth: 'Growth',
};

const STATUS_LABELS: Record<string, string> = {
  scan_complete: 'Scan Complete',
  setup_pending: 'Setup Pending',
  setup_complete: 'Setup Complete',
  active: 'Active',
};

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const prevFilters = useRef({ search, plan, status });

  useEffect(() => {
    // Reset page to 1 when filters change
    const filtersChanged =
      prevFilters.current.search !== search ||
      prevFilters.current.plan !== plan ||
      prevFilters.current.status !== status;
    prevFilters.current = { search, plan, status };
    const currentPage = filtersChanged ? 1 : page;

    let cancelled = false;

    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    if (search) params.set('search', search);
    if (plan) params.set('plan', plan);
    if (status) params.set('status', status);

    void (async () => {
      const res = await fetch(`/api/admin/clients?${params}`);
      if (cancelled || !res.ok) return;
      const json = await res.json();
      setClients(json.data.clients);
      setTotal(json.data.total);
      setLoading(false);
      if (filtersChanged) setPage(1);
    })();

    return () => { cancelled = true; };
  }, [page, search, plan, status]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
      <p className="mt-1 text-gray-500">{total} total</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 w-64"
        />
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All plans</option>
          <option value="free_scan">Free</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All statuses</option>
          <option value="scan_complete">Scan Complete</option>
          <option value="setup_pending">Setup Pending</option>
          <option value="setup_complete">Setup Complete</option>
          <option value="active">Active</option>
        </select>
      </div>

      <Card className="mt-4">
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded bg-gray-100" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No clients found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="pb-3 font-medium">Business</th>
                    <th className="pb-3 font-medium">City</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Score</th>
                    <th className="pb-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-500"
                        >
                          {c.businessName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {c.city}{c.state ? `, ${c.state}` : ''}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {PLAN_LABELS[c.plan] ?? c.plan}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-600">
                        {STATUS_LABELS[c.onboardingStatus] ?? c.onboardingStatus}
                      </td>
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {c.latestScore ?? '--'}
                      </td>
                      <td className="py-3 text-gray-400 text-xs">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
