'use client';

import type { ScanResult } from '@/types';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { Card } from '@/components/ui/card';
import { PLATFORM_LABELS } from '@/lib/constants';

interface ScanResultsProps {
  result: ScanResult;
}

function PlatformIcon({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
      {PLATFORM_LABELS[platform] || platform}
    </span>
  );
}

export function ScanResults({ result }: ScanResultsProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Scan Results for {result.businessInfo.name}
        </h1>
        {result.businessInfo.category && result.businessInfo.city && (
          <p className="mt-1 text-gray-500">
            {result.businessInfo.category} in {result.businessInfo.city}
          </p>
        )}
      </div>

      {/* Score + Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col items-center justify-center py-8">
          <p className="mb-4 text-sm font-medium text-gray-500 uppercase tracking-wide">
            AI Visibility Score
          </p>
          <div className="relative">
            <ScoreGauge score={result.score} size={180} />
          </div>
        </Card>

        <Card title="Score Breakdown">
          <div className="space-y-4">
            <BreakdownRow
              label="Query Coverage"
              value={result.breakdown.queryCoverage}
              weight={40}
            />
            <BreakdownRow
              label="Platform Coverage"
              value={result.breakdown.platformCoverage}
              weight={30}
            />
            <BreakdownRow
              label="Position Quality"
              value={result.breakdown.positionQuality}
              weight={20}
            />
            <BreakdownRow
              label="Technical Setup"
              value={result.breakdown.setupComplete}
              weight={10}
            />
          </div>
        </Card>
      </div>

      {/* Platform Cards */}
      <Card title="Platform Results">
        <div className="grid gap-4 sm:grid-cols-2">
          {result.platforms.map((p) => (
            <div
              key={p.platform}
              className="flex items-center justify-between rounded-lg border border-gray-100 p-4"
            >
              <div>
                <PlatformIcon platform={p.platform} />
                <p className="mt-2 text-sm text-gray-500">
                  {p.queriesChecked} queries checked
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {p.citedCount}/{p.queriesChecked}
                </p>
                <p className="text-xs text-gray-500">cited</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Query Results Table */}
      <Card title="Query Results">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Query results by platform">
            <thead>
              <tr className="border-b border-gray-100">
                <th scope="col" className="py-2 pr-4 text-left font-medium text-gray-500">
                  Query
                </th>
                {result.platforms.map((p) => (
                  <th
                    scope="col"
                    key={p.platform}
                    className="px-3 py-2 text-center font-medium text-gray-500"
                  >
                    <PlatformIcon platform={p.platform} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.queries.map((q) => (
                <tr key={q.query} className="border-b border-gray-50">
                  <td className="py-3 pr-4 text-gray-900">{q.query}</td>
                  {q.results.map((r) => (
                    <td key={r.platform} className="px-3 py-3 text-center">
                      {r.cited ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <svg
                            className="h-4 w-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {r.position && (
                            <span className="text-xs">#{r.position}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">--</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top Sources */}
      {result.topSources.length > 0 && (
        <Card title="Sources AI Trusts">
          <p className="mb-4 text-sm text-gray-500">
            These are the domains AI platforms cite most for queries in your
            category.
          </p>
          <div className="space-y-2">
            {result.topSources.map((source, i) => (
              <div
                key={source.domain}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {source.domain}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {source.citationCount}{' '}
                  {source.citationCount === 1 ? 'citation' : 'citations'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Competitor */}
      {result.competitor && (
        <Card title="Top Competitor Spotted">
          <p className="text-sm text-gray-500 mb-2">
            This business appeared frequently in AI responses for your queries.
          </p>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
            <p className="font-semibold text-gray-900">
              {result.competitor.name}
            </p>
            {result.competitor.url && (
              <p className="text-sm text-gray-500 mt-1">
                {result.competitor.url}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: number;
}) {
  const percentage = Math.min(Math.round(value * 100), 100);
  const contribution = Math.round(value * weight);

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">
          {contribution}/{weight} pts
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
