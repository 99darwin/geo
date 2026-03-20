'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { ScoreChart } from '@/components/ui/score-chart';

interface Recommendation {
  id: string;
  severity: 'critical' | 'important' | 'suggestion';
  title: string;
  description: string;
  actionUrl?: string;
}

interface CompetitorData {
  name: string;
  domain: string | null;
  citedCount: number;
  platforms: string[];
}

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
  scoreHistory: { period: string; score: number }[];
  recommendations: Recommendation[];
  competitors: CompetitorData[];
}

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  gemini: 'Gemini',
  copilot: 'Copilot',
};

export default function ClientDashboardPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId) return;

    fetch(`/api/dashboard?clientId=${clientId}`)
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
  }, [clientId]);

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

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <p className="py-8 text-center text-gray-500">Client not found.</p>
          <div className="text-center pb-4">
            <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { client } = data;

  if (client.onboardingStatus === 'setup_pending' || client.onboardingStatus === 'setup_running') {
    return <SetupPendingState businessName={client.businessName} />;
  }

  if (client.plan === 'free_scan') {
    return <FreeScanState clientId={client.id} websiteUrl={client.websiteUrl} data={data} />;
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

function FreeScanState({ clientId, websiteUrl, data }: { clientId: string; websiteUrl?: string; data: DashboardData }) {
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        &larr; All Businesses
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">{data.client.businessName}</h1>
      <p className="mt-1 text-gray-500">{websiteUrl}</p>

      {data.visibilityScore && (
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Card className="flex flex-col items-center">
            <p className="text-sm font-medium text-gray-500 mb-2">Score</p>
            <ScoreGauge score={data.visibilityScore.score} size={100} />
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Query Coverage</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{data.visibilityScore.queryCoverage}%</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-gray-500">Platform Coverage</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{data.visibilityScore.platformCoverage}%</p>
          </Card>
        </div>
      )}

      <Card className="mt-8">
        <div className="text-center py-8">
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

      {/* Show reports link if any exist */}
      <div className="mt-4 text-center">
        <Link
          href={`/dashboard/${clientId}/reports`}
          className="text-sm text-indigo-600 hover:underline"
        >
          View scan reports
        </Link>
      </div>
    </div>
  );
}

function ActiveDashboard({ data }: { data: DashboardData }) {
  const { client, visibilityScore, recentCitations, generatedFiles, scoreHistory, recommendations, competitors } = data;
  const citedPlatforms = new Set(
    recentCitations.filter((c) => c.cited).map((c) => c.platform)
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        &larr; All Businesses
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.businessName}</h1>
          <p className="mt-1 text-gray-500">
            {client.city}{client.state ? `, ${client.state}` : ''} — {client.websiteUrl}
          </p>
        </div>
        <ManageBillingButton clientId={client.id} />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Score History Chart */}
      {scoreHistory.length > 0 && (
        <Card className="mt-6" title="Score History">
          <ScoreChart data={scoreHistory} />
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="mt-6" title="Recommendations">
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="flex items-start gap-3 rounded-lg border border-gray-100 px-4 py-3"
              >
                <span
                  className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    rec.severity === 'critical'
                      ? 'bg-red-500'
                      : rec.severity === 'important'
                        ? 'bg-yellow-500'
                        : 'bg-blue-400'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
          <div className="mt-3 text-center">
            <Link
              href={`/dashboard/${client.id}/history`}
              className="text-sm text-indigo-600 hover:underline"
            >
              View all citations
            </Link>
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

      {/* File Implementation Instructions */}
      {(generatedFiles.llmsTxt || generatedFiles.schemaJson) && (
        <FileInstructions clientId={client.id} generatedFiles={generatedFiles} />
      )}

      {/* Competitors */}
      {competitors.length > 0 && (
        <Card className="mt-6" title="Competitor Visibility">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-3 font-medium">Competitor</th>
                  <th className="pb-3 font-medium">Cited In</th>
                  <th className="pb-3 font-medium">Platforms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {competitors.map((comp) => (
                  <tr key={comp.name}>
                    <td className="py-3 pr-4 text-gray-900">{comp.name}</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {comp.citedCount} {comp.citedCount === 1 ? 'query' : 'queries'}
                    </td>
                    <td className="py-3 text-gray-600">
                      {comp.platforms
                        .map((p) => PLATFORM_LABELS[p] ?? p)
                        .join(', ') || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Quick links */}
      <div className="mt-6 flex gap-4">
        <Link href={`/dashboard/${client.id}/reports`}>
          <Button variant="secondary" size="sm">View Reports</Button>
        </Link>
        <Link href={`/dashboard/${client.id}/history`}>
          <Button variant="secondary" size="sm">Citation History</Button>
        </Link>
      </div>
    </div>
  );
}

function FileInstructions({
  clientId,
  generatedFiles,
}: {
  clientId: string;
  generatedFiles: { llmsTxt: boolean; schemaJson: boolean };
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const llmsTxtUrl = `${appUrl}/api/geo/llms/${clientId}/llms.txt`;
  const schemaUrl = `${appUrl}/api/geo/schema/${clientId}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-gray-900">
          How to Add These Files to Your Site
        </span>
        <span className="text-gray-400 text-sm">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-6">
          {generatedFiles.llmsTxt && (
            <div>
              <h4 className="text-sm font-medium text-gray-900">llms.txt</h4>
              <p className="mt-1 text-xs text-gray-500">
                Add a redirect or proxy at <code className="bg-gray-100 px-1 rounded">yourdomain.com/llms.txt</code> pointing to:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-gray-50 px-3 py-2 text-xs text-gray-700 border border-gray-200 truncate">
                  {llmsTxtUrl}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(llmsTxtUrl, 'llms')}
                >
                  {copied === 'llms' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          {generatedFiles.schemaJson && (
            <div>
              <h4 className="text-sm font-medium text-gray-900">JSON-LD Schema</h4>
              <p className="mt-1 text-xs text-gray-500">
                Add this script tag to the <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code> of your homepage:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-gray-50 px-3 py-2 text-xs text-gray-700 border border-gray-200 truncate">
                  {`<script src="${schemaUrl}"></script>`}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(`<script src="${schemaUrl}"></script>`, 'schema')
                  }
                >
                  {copied === 'schema' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ManageBillingButton({ clientId }: { clientId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
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
