'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const URL_PATTERN = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;

interface DashboardScanFormProps {
  onScanComplete: () => void;
}

export function DashboardScanForm({ onScanComplete }: DashboardScanFormProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL.');
      return;
    }

    if (!URL_PATTERN.test(trimmed)) {
      setError('Please enter a valid URL (e.g., example.com).');
      return;
    }

    setIsLoading(true);

    const normalizedUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      const response = await fetch('/api/dashboard/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError('Rate limit reached. Please try again in a few minutes.');
          return;
        }
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      // Store result for the scan results page, then refresh dashboard
      sessionStorage.setItem('scanResult', JSON.stringify(data.data));
      onScanComplete();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Enter your website URL..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            error={error}
            disabled={isLoading}
          />
        </div>
        <Button type="submit" size="lg" isLoading={isLoading}>
          {isLoading ? 'Scanning...' : 'Scan'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Scan a website to check its AI visibility. Results are saved to your dashboard.
      </p>
    </form>
  );
}
