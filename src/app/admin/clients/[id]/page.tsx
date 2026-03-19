'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AdminNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

interface ClientDetail {
  id: string;
  businessName: string;
  websiteUrl: string;
  city: string;
  state: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  services: string[];
  hours: string | null;
  googleBusinessUrl: string | null;
  plan: string;
  onboardingStatus: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; createdAt: string };
  visibilityScores: { id: string; score: number; period: string; queryCoverage: number; platformCoverage: number }[];
  citations: {
    id: string;
    platform: string;
    cited: boolean;
    position: number | null;
    checkedAt: string;
    query: { queryText: string };
  }[];
  generatedFiles: { id: string; fileType: string; version: number; createdAt: string }[];
  adminNotes: AdminNote[];
  competitors: { id: string; competitorName: string; competitorUrl: string | null }[];
  queries: { id: string; queryText: string }[];
}

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  google_ai: 'Google AI',
  gemini: 'Gemini',
  copilot: 'Copilot',
};

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

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/clients/${id}`)
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        setClient(json.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setNoteLoading(true);

    try {
      const res = await fetch(`/api/admin/clients/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      });

      if (res.ok) {
        const json = await res.json();
        setClient((prev) =>
          prev
            ? { ...prev, adminNotes: [json.data, ...prev.adminNotes] }
            : prev
        );
        setNoteContent('');
      }
    } finally {
      setNoteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-48 rounded-lg bg-gray-200" />
        <div className="h-48 rounded-lg bg-gray-200" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <p className="text-center text-gray-500">Client not found.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/admin/clients" className="hover:text-indigo-600">
          Clients
        </Link>
        <span>/</span>
        <span className="text-gray-900">{client.businessName}</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{client.businessName}</h1>
      <p className="mt-1 text-gray-500">
        {client.city}{client.state ? `, ${client.state}` : ''} — {client.websiteUrl}
      </p>

      {/* Overview Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Plan</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {PLAN_LABELS[client.plan] ?? client.plan}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Status</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {STATUS_LABELS[client.onboardingStatus] ?? client.onboardingStatus}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Latest Score</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {client.visibilityScores[0]?.score ?? '--'}
          </p>
        </Card>
      </div>

      {/* Business Details */}
      <Card className="mt-6" title="Business Details">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Phone</dt>
            <dd className="text-gray-900">{client.phone ?? 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Address</dt>
            <dd className="text-gray-900">{client.address ?? 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Category</dt>
            <dd className="text-gray-900">{client.category ?? 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Owner</dt>
            <dd className="text-gray-900">
              {client.user.name ?? client.user.email ?? 'Unknown'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Services</dt>
            <dd className="text-gray-900">
              {client.services.length > 0 ? client.services.join(', ') : 'N/A'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900">
              {new Date(client.createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Score History */}
      {client.visibilityScores.length > 0 && (
        <Card className="mt-6" title="Score History">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-3 font-medium">Period</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Query Coverage</th>
                  <th className="pb-3 font-medium">Platform Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {client.visibilityScores.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 text-gray-600">
                      {new Date(s.period).toLocaleDateString()}
                    </td>
                    <td className="py-2 font-medium text-gray-900">{s.score}</td>
                    <td className="py-2 text-gray-600">{s.queryCoverage}%</td>
                    <td className="py-2 text-gray-600">{s.platformCoverage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent Citations */}
      {client.citations.length > 0 && (
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
                {client.citations.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 text-gray-900 max-w-[200px] truncate">
                      {c.query.queryText}
                    </td>
                    <td className="py-2 text-gray-600">
                      {PLATFORM_LABELS[c.platform] ?? c.platform}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.cited
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.cited ? 'Cited' : 'Not cited'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400 text-xs">
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
      {client.generatedFiles.length > 0 && (
        <Card className="mt-6" title="Generated Files">
          <div className="space-y-2">
            {client.generatedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-700">
                  {f.fileType === 'llms_txt' ? 'llms.txt' : 'JSON-LD Schema'}
                </span>
                <span className="text-xs text-gray-400">
                  v{f.version} — {new Date(f.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Admin Notes */}
      <Card className="mt-6" title="Admin Notes">
        <form onSubmit={handleAddNote} className="mb-4">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
          <Button
            type="submit"
            size="sm"
            className="mt-2"
            isLoading={noteLoading}
            disabled={!noteContent.trim()}
          >
            Add Note
          </Button>
        </form>

        {client.adminNotes.length === 0 ? (
          <p className="text-sm text-gray-500">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {client.adminNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-gray-100 px-4 py-3"
              >
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{note.author}</span>
                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
