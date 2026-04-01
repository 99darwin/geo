'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { ScoreChart } from '@/components/ui/score-chart';
import { PLATFORM_LABELS } from '@/lib/constants';

interface Recommendation {
  id: string;
  severity: 'critical' | 'important' | 'suggestion';
  title: string;
  description: string;
  actionUrl?: string;
}

interface CompetitorData {
  id?: string;
  name: string;
  domain: string | null;
  citedCount: number;
  platforms: string[];
  isAutoDetected?: boolean;
}

interface DashboardData {
  client: {
    id: string;
    businessName: string;
    websiteUrl: string;
    city: string | null;
    state: string | null;
    category: string | null;
    serviceArea: string | null;
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
        <span aria-hidden="true">&larr;</span> All Businesses
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
  const { visibilityScore, recentCitations, generatedFiles, scoreHistory, recommendations, competitors } = data;
  const [localClient, setLocalClient] = useState(data.client);
  const client = localClient;
  const citedPlatforms = new Set(
    recentCitations.filter((c) => c.cited).map((c) => c.platform)
  );

  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckMessage, setRecheckMessage] = useState('');
  const [recheckStatus, setRecheckStatus] = useState<'success' | 'error' | ''>('');

  const [profileEditing, setProfileEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    businessName: client.businessName,
    category: client.category ?? '',
    serviceArea: client.serviceArea ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  function handleProfileCancel() {
    setProfileData({
      businessName: client.businessName,
      category: client.category ?? '',
      serviceArea: client.serviceArea ?? '',
      city: client.city ?? '',
      state: client.state ?? '',
    });
    setProfileError('');
    setProfileEditing(false);
  }

  async function handleProfileSave() {
    if (!profileData.businessName.trim()) {
      setProfileError('Business name is required.');
      return;
    }
    setProfileSaving(true);
    setProfileError('');

    const changed: Record<string, string | null> = {};
    if (profileData.businessName !== client.businessName) changed.businessName = profileData.businessName;
    if (profileData.category !== (client.category ?? '')) changed.category = profileData.category || null;
    if (profileData.serviceArea !== (client.serviceArea ?? '')) changed.serviceArea = profileData.serviceArea || null;
    if (profileData.city !== (client.city ?? '')) changed.city = profileData.city || null;
    if (profileData.state !== (client.state ?? '')) changed.state = profileData.state || null;

    if (Object.keys(changed).length === 0) {
      setProfileEditing(false);
      setProfileSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/dashboard/client', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, ...changed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileError(json.error || 'Failed to save profile.');
        return;
      }
      setLocalClient((prev) => ({
        ...prev,
        businessName: profileData.businessName,
        category: profileData.category || null,
        serviceArea: profileData.serviceArea || null,
        city: profileData.city || null,
        state: profileData.state || null,
      }));
      setProfileEditing(false);
    } catch {
      setProfileError('Something went wrong.');
    } finally {
      setProfileSaving(false);
    }
  }

  const [localCompetitors, setLocalCompetitors] = useState(competitors);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompUrl, setNewCompUrl] = useState('');
  const [addingComp, setAddingComp] = useState(false);
  const [compError, setCompError] = useState('');

  async function handleRecheck() {
    setRecheckLoading(true);
    setRecheckMessage('');
    setRecheckStatus('');
    try {
      const res = await fetch('/api/dashboard/recheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRecheckMessage(json.error || 'Failed to trigger re-run.');
        setRecheckStatus('error');
      } else {
        setRecheckMessage('Report is being regenerated. Results will appear in a few minutes.');
        setRecheckStatus('success');
      }
    } catch {
      setRecheckMessage('Something went wrong.');
      setRecheckStatus('error');
    } finally {
      setRecheckLoading(false);
    }
  }

  async function handleAddCompetitor() {
    if (!newCompName.trim()) return;
    setAddingComp(true);
    setCompError('');
    try {
      const res = await fetch('/api/dashboard/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          competitorName: newCompName.trim(),
          competitorUrl: newCompUrl.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCompError(json.error || 'Failed to add competitor.');
        return;
      }
      let domain: string | null = null;
      if (json.data.competitorUrl) {
        try {
          domain = new URL(json.data.competitorUrl).hostname;
        } catch {
          domain = null;
        }
      }
      setLocalCompetitors(prev => [...prev, {
        name: json.data.competitorName,
        domain,
        citedCount: 0,
        platforms: [],
        id: json.data.id,
        isAutoDetected: false,
      }]);
      setNewCompName('');
      setNewCompUrl('');
      setShowAddForm(false);
    } catch {
      setCompError('Something went wrong.');
    } finally {
      setAddingComp(false);
    }
  }

  async function handleDeleteCompetitor(competitorId: string) {
    setLocalCompetitors(prev => prev.filter(c => c.id !== competitorId));
    try {
      const res = await fetch(`/api/dashboard/competitors/${competitorId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setLocalCompetitors(competitors);
      }
    } catch {
      setLocalCompetitors(competitors);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <span aria-hidden="true">&larr;</span> All Businesses
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.businessName}</h1>
          <p className="mt-1 text-gray-500">
            {client.city && <>{client.city}{client.state ? `, ${client.state}` : ''} &mdash; </>}{client.websiteUrl}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRecheck} isLoading={recheckLoading}>
            Re-run Report
          </Button>
          <ManageBillingButton clientId={client.id} />
        </div>
      </div>
      {recheckMessage && (
        <p className={`mt-2 text-xs ${recheckStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {recheckMessage}
        </p>
      )}

      {/* Business Profile */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Business Profile</h3>
          {!profileEditing && (
            <Button variant="secondary" size="sm" onClick={() => setProfileEditing(true)}>
              Edit
            </Button>
          )}
        </div>

        {profileEditing ? (
          <div className="space-y-4">
            <Input
              label="Business Name"
              type="text"
              value={profileData.businessName}
              onChange={(e) => setProfileData((prev) => ({ ...prev, businessName: e.target.value }))}
              required
            />
            <Input
              label="Category"
              type="text"
              placeholder="e.g. clothing store, dental practice"
              value={profileData.category}
              onChange={(e) => setProfileData((prev) => ({ ...prev, category: e.target.value }))}
            />
            <fieldset className="border-0 p-0 m-0">
              <legend className="block text-sm font-medium text-gray-700 mb-1">
                Service area
              </legend>
              <div className="flex flex-wrap gap-4">
                {(['local', 'regional', 'national', 'global'] as const).map((option) => (
                  <label key={option} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="profileServiceArea"
                      value={option}
                      checked={profileData.serviceArea === option}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfileData((prev) => ({
                          ...prev,
                          serviceArea: val,
                          ...(val === 'national' || val === 'global' ? { city: '', state: '' } : {}),
                        }));
                      }}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>
            {(profileData.serviceArea === 'local' || profileData.serviceArea === 'regional') && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    label="City"
                    type="text"
                    value={profileData.city}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="State"
                    type="text"
                    value={profileData.state}
                    onChange={(e) => setProfileData((prev) => ({ ...prev, state: e.target.value }))}
                  />
                </div>
              </div>
            )}
            {profileError && <p className="text-xs text-red-600">{profileError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleProfileSave} isLoading={profileSaving}>
                Save
              </Button>
              <Button variant="secondary" size="sm" onClick={handleProfileCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-gray-500">Business Name</p>
              <p className="font-medium text-gray-900">{client.businessName}</p>
            </div>
            <div>
              <p className="text-gray-500">Category</p>
              <p className="font-medium text-gray-900">{client.category || '--'}</p>
            </div>
            <div>
              <p className="text-gray-500">Service Area</p>
              <p className="font-medium text-gray-900">
                {client.serviceArea
                  ? client.serviceArea.charAt(0).toUpperCase() + client.serviceArea.slice(1)
                  : '--'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">City</p>
              <p className="font-medium text-gray-900">{client.city || '--'}</p>
            </div>
            <div>
              <p className="text-gray-500">State</p>
              <p className="font-medium text-gray-900">{client.state || '--'}</p>
            </div>
          </div>
        )}
      </Card>

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
            <table className="w-full text-sm" aria-label="Recent citations">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th scope="col" className="pb-3 font-medium">Query</th>
                  <th scope="col" className="pb-3 font-medium">Platform</th>
                  <th scope="col" className="pb-3 font-medium">Status</th>
                  <th scope="col" className="pb-3 font-medium">Date</th>
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
      <Card className="mt-6" title="Competitor Visibility">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Competitor visibility">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th scope="col" className="pb-3 font-medium">Competitor</th>
                <th scope="col" className="pb-3 font-medium">Cited In</th>
                <th scope="col" className="pb-3 font-medium">Platforms</th>
                <th scope="col" className="pb-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {localCompetitors.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                    No competitors detected yet. Add yours below.
                  </td>
                </tr>
              )}
              {localCompetitors.map((comp) => (
                <tr key={comp.id || comp.name}>
                  <td className="py-3 pr-4 text-gray-900">
                    <span>{comp.name}</span>
                    {comp.isAutoDetected === true && (
                      <span className="ml-2 text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Auto</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {comp.citedCount} {comp.citedCount === 1 ? 'query' : 'queries'}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {comp.platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ') || '--'}
                  </td>
                  <td className="py-3">
                    {comp.id && (
                      <button
                        onClick={() => handleDeleteCompetitor(comp.id!)}
                        className="text-gray-400 hover:text-red-500 text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Remove competitor"
                        aria-label={`Remove ${comp.name}`}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showAddForm ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddCompetitor(); }}
            className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4"
          >
            <div className="flex gap-2">
              <Input
                label="Competitor name"
                type="text"
                placeholder="Competitor name"
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                className="flex-1"
              />
              <Input
                label="Website URL (optional)"
                type="text"
                placeholder="https://example.com"
                value={newCompUrl}
                onChange={(e) => setNewCompUrl(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={addingComp}>
                Add
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => { setShowAddForm(false); setCompError(''); }}>
                Cancel
              </Button>
            </div>
            {compError && <p className="text-xs text-red-600">{compError}</p>}
          </form>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-500"
          >
            + Add Competitor
          </button>
        )}
      </Card>

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
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {
      // Silently fail - clipboard API may not be available
    });
  };

  return (
    <Card className="mt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="file-instructions-content"
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-gray-900">
          How to Add These Files to Your Site
        </span>
        <span className="text-gray-400 text-sm" aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div id="file-instructions-content" className="mt-4 space-y-6">
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
