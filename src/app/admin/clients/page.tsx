'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PLAN_LABELS, STATUS_LABELS } from '@/lib/admin-constants';

interface ClientItem {
  id: string;
  businessName: string;
  city: string | null;
  state: string | null;
  plan: string;
  onboardingStatus: string;
  latestScore: number | null;
  createdAt: string;
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [retryCount, setRetryCount] = useState(0);
  const prevFilters = useRef({ search: debouncedSearch, plan, status });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // Reset page to 1 when filters change
    const filtersChanged =
      prevFilters.current.search !== debouncedSearch ||
      prevFilters.current.plan !== plan ||
      prevFilters.current.status !== status;
    prevFilters.current = { search: debouncedSearch, plan, status };
    const currentPage = filtersChanged ? 1 : page;

    let cancelled = false;

    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (plan) params.set('plan', plan);
    if (status) params.set('status', status);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/clients?${params}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const json = await res.json();
        setClients(json.data.clients);
        setTotal(json.data.total);
        setError(false);
        setLoading(false);
        if (filtersChanged) setPage(1);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [page, debouncedSearch, plan, status, retryCount]);

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
          aria-label="Search clients by name"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 w-64"
        />
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          aria-label="Filter by plan"
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
          aria-label="Filter by status"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All statuses</option>
          <option value="scan_complete">Scan Complete</option>
          <option value="setup_pending">Setup Pending</option>
          <option value="setup_complete">Setup Complete</option>
          <option value="active">Active</option>
        </select>
      </div>

      {error && (
        <Card className="mt-4">
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-500">Failed to load clients.</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setError(false);
                setLoading(true);
                setRetryCount((c) => c + 1);
              }}
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {!error && <Card className="mt-4">
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
      </Card>}
    </div>
  );
}
