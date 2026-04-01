'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { DashboardScanForm } from '@/components/dashboard-scan-form';

interface ClientItem {
  id: string;
  businessName: string;
  websiteUrl: string;
  city: string | null;
  state: string | null;
  category: string | null;
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
  setup_pending: 'Setting Up',
  setup_running: 'Setting Up',
  setup_complete: 'Active',
  active: 'Active',
};

export default function DashboardPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard/clients')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load');
        const json = await res.json();
        setClients(json.data.clients);
      })
      .catch(() => setError('Failed to load your businesses.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <p className="text-center text-red-600">{error}</p>
        </Card>
      </div>
    );
  }

  const paidClients = clients.filter((c) => c.plan !== 'free_scan');
  const freeClients = clients.filter((c) => c.plan === 'free_scan');

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            {paidClients.length > 0
              ? `Managing ${paidClients.length} business${paidClients.length !== 1 ? 'es' : ''}`
              : 'Get started by scanning your website'}
          </p>
        </div>
        <Link href="/onboarding">
          <Button size="sm">Add Business</Button>
        </Link>
      </div>

      {/* Paid clients */}
      {paidClients.length > 0 && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {paidClients.map((client) => (
            <Link key={client.id} href={`/dashboard/${client.id}`}>
              <Card className="hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  {client.latestScore !== null ? (
                    <ScoreGauge score={client.latestScore} size={56} />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-400">
                      --
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {client.businessName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {client.websiteUrl}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {client.city}{client.state ? `, ${client.state}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {PLAN_LABELS[client.plan] ?? client.plan}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    client.onboardingStatus === 'active' || client.onboardingStatus === 'setup_complete'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-yellow-50 text-yellow-700'
                  }`}>
                    {STATUS_LABELS[client.onboardingStatus] ?? client.onboardingStatus}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Free scan section */}
      <Card className="mt-8">
        <div className="flex flex-col items-center py-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {paidClients.length > 0 ? 'Run a Free Scan' : 'Scan Your Website'}
          </h2>
          <p className="mt-2 mb-6 text-gray-500 max-w-md text-center">
            {paidClients.length > 0
              ? 'Check any website\'s AI visibility with a quick scan.'
              : 'Enter your business URL to check how visible you are to AI search engines.'}
          </p>
          <DashboardScanForm />
        </div>
      </Card>

      {/* Free scan results */}
      {freeClients.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Free Scan Results</h3>
          <div className="space-y-3">
            {freeClients.map((client) => (
              <Link key={client.id} href={`/dashboard/${client.id}`}>
                <Card className="hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    {client.latestScore !== null ? (
                      <ScoreGauge score={client.latestScore} size={40} />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
                        --
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {client.businessName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{client.websiteUrl}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
