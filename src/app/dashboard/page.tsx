'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DashboardData {
  client: {
    id: string;
    businessName: string;
    websiteUrl: string;
    city: string;
    state: string | null;
    category: string | null;
    plan: string;
    onboardingStatus: string;
  };
  visibilityScore: {
    score: number;
    queryCoverage: number;
    platformCoverage: number;
    period: string;
    breakdown: Record<string, unknown>;
  } | null;
  recentCitations: {
    id: string;
    platform: string;
    cited: boolean;
    position: number | null;
    queryText: string;
    checkedAt: string;
  }[];
  generatedFiles: {
    llmsTxt: boolean;
    schemaJson: boolean;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          if (res.status === 404) {
            setError('no_client');
            return;
          }
          throw new Error('Failed to load dashboard');
        }
        const json = await res.json();
        setData(json.data);
      } catch {
        setError('Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error === 'no_client') {
    return <FreeScanState />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="text-center py-12">
          <p className="text-red-600">{error}</p>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { client } = data;

  if (client.onboardingStatus === 'setup_pending') {
    return <SetupPendingState businessName={client.businessName} />;
  }

  if (client.plan === 'free_scan') {
    return <FreeScanState websiteUrl={client.websiteUrl} />;
  }

  return <ActiveDashboard data={data} />;
}

function SetupPendingState({ businessName }: { businessName: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Setting Up Your Account</h1>
      <p className="mt-1 text-gray-500">{businessName}</p>

      <Card className="mt-8">
        <div className="text-center py-12">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <h2 className="mt-6 text-lg font-semibold text-gray-900">
            Analyzing your website
          </h2>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            We&apos;re crawling your site, generating AI-optimized files, and
            checking your visibility across AI platforms. This usually takes a few minutes.
          </p>
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </div>
      </Card>
    </div>
  );
}

function FreeScanState({ websiteUrl }: { websiteUrl?: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-500">Upgrade to unlock full AI visibility monitoring.</p>

      <Card className="mt-8">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-gray-900">
            Unlock Continuous AI Monitoring
          </h2>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            Get monthly citation tracking, AI-optimized files, competitor analysis,
            and visibility reports.
          </p>
          <Link href={`/onboarding${websiteUrl ? `?url=${encodeURIComponent(websiteUrl)}` : ''}`}>
            <Button className="mt-6" size="lg">
              Get Started — $299 + $49/mo
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function ActiveDashboard({ data }: { data: DashboardData }) {
  const { client, visibilityScore, recentCitations, generatedFiles } = data;
  const citedCount = recentCitations.filter((c) => c.cited).length;
  const uniquePlatforms = new Set(recentCitations.map((c) => c.platform)).size;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.businessName}</h1>
          <p className="mt-1 text-gray-500">{client.websiteUrl}</p>
        </div>
        <ManageBillingButton />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-gray-500">Visibility Score</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {visibilityScore ? visibilityScore.score : '--'}
          </p>
          {visibilityScore && (
            <p className="mt-1 text-xs text-gray-400">out of 100</p>
          )}
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500">Citations Found</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{citedCount}</p>
          <p className="mt-1 text-xs text-gray-400">
            of {recentCitations.length} checks
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500">AI Platforms</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{uniquePlatforms}</p>
          <p className="mt-1 text-xs text-gray-400">monitored</p>
        </Card>
      </div>

      {/* Generated Files */}
      <Card className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Generated Files</h2>
        <div className="mt-4 space-y-3">
          <FileStatus label="llms.txt" isActive={generatedFiles.llmsTxt} />
          <FileStatus label="JSON-LD Schema" isActive={generatedFiles.schemaJson} />
        </div>
      </Card>

      {/* Recent Citations */}
      {recentCitations.length > 0 && (
        <Card className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Recent Citations</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {recentCitations.slice(0, 10).map((citation) => (
              <div key={citation.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{citation.queryText}</p>
                  <p className="text-xs text-gray-500 capitalize">{citation.platform.replace('_', ' ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {citation.cited ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      Cited{citation.position ? ` #${citation.position}` : ''}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500">
                      Not cited
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function FileStatus({ label, isActive }: { label: string; isActive: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isActive ? (
          <span className="h-2 w-2 rounded-full bg-green-500" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-gray-300" />
        )}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      {isActive && (
        <span className="text-xs text-gray-400">Active</span>
      )}
    </div>
  );
}

function ManageBillingButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const json = await res.json();
      if (json.data?.url) {
        window.location.href = json.data.url;
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} isLoading={isLoading}>
      Manage Billing
    </Button>
  );
}
