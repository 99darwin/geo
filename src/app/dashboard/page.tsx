'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ui/score-gauge';

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

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  gemini: 'Gemini',
  copilot: 'Copilot',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(async (res) => {
        if (res.status === 404) {
          setData(null);
          return;
        }
        if (!res.ok) throw new Error('Failed to load dashboard');
        const json = await res.json();
        setData(json.data);
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-gray-200" />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-gray-200" />
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

  // No client yet — show upgrade CTA
  if (!data) {
    return <FreeScanState />;
  }

  const { client } = data;

  if (client.onboardingStatus === 'setup_pending' || client.onboardingStatus === 'setup_running') {
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
  const citedPlatforms = new Set(
    recentCitations.filter((c) => c.cited).map((c) => c.platform)
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.businessName}</h1>
          <p className="mt-1 text-gray-500">
            {client.city}{client.state ? `, ${client.state}` : ''} — {client.websiteUrl}
          </p>
        </div>
        <ManageBillingButton />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Visibility Score */}
        <Card className="flex flex-col items-center">
          <p className="text-sm font-medium text-gray-500 mb-2">Visibility Score</p>
          {visibilityScore ? (
            <div className="relative">
              <ScoreGauge score={visibilityScore.score} size={120} />
            </div>
          ) : (
            <p className="text-3xl font-bold text-gray-300">--</p>
          )}
        </Card>

        {/* Query Coverage */}
        <Card>
          <p className="text-sm font-medium text-gray-500">Query Coverage</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {visibilityScore ? `${visibilityScore.queryCoverage}%` : '--'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Queries where your business appears
          </p>
        </Card>

        {/* Platform Coverage */}
        <Card>
          <p className="text-sm font-medium text-gray-500">Platform Coverage</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {visibilityScore ? `${visibilityScore.platformCoverage}%` : '--'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            AI platforms citing your business
          </p>
        </Card>
      </div>

      {/* Platform Status */}
      <Card className="mt-6" title="AI Platform Status">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  citedPlatforms.has(key) ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <span className="ml-auto text-xs text-gray-400">
                {citedPlatforms.has(key) ? 'Cited' : 'Not cited'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Citations */}
      {recentCitations.length > 0 && (
        <Card className="mt-6" title="Recent Citations">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-3 font-medium">Query</th>
                  <th className="pb-3 font-medium">Platform</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentCitations.slice(0, 10).map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4 text-gray-900 max-w-[200px] truncate">
                      {c.queryText}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {PLATFORM_LABELS[c.platform] ?? c.platform}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.cited
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.cited ? 'Cited' : 'Not cited'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400 text-xs">
                      {new Date(c.checkedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Generated Files */}
      <Card className="mt-6" title="Generated Files">
        <div className="flex gap-4">
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${
              generatedFiles.llmsTxt
                ? 'border-green-200 bg-green-50'
                : 'border-gray-100 bg-gray-50'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                generatedFiles.llmsTxt ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            <span className="text-sm font-medium text-gray-700">llms.txt</span>
          </div>
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${
              generatedFiles.schemaJson
                ? 'border-green-200 bg-green-50'
                : 'border-gray-100 bg-gray-50'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                generatedFiles.schemaJson ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            <span className="text-sm font-medium text-gray-700">JSON-LD Schema</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ManageBillingButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const json = await res.json();
      if (json.data?.url) {
        window.location.href = json.data.url;
      } else {
        setError('Failed to open billing portal. Please try again.');
      }
    } catch {
      setError('Failed to open billing portal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" size="sm" onClick={handleClick} isLoading={isLoading}>
        Manage Billing
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
