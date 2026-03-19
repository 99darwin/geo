'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const URL_PATTERN = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;

export function ScanForm() {
  const router = useRouter();
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
      const response = await fetch('/api/scan', {
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

      sessionStorage.setItem('scanResult', JSON.stringify(data.data));
      router.push(`/scan?url=${encodeURIComponent(trimmed)}`);
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
            onChange={(e) => setUrl(e.target.value)}
            error={error}
            disabled={isLoading}
          />
        </div>
        <Button type="submit" size="lg" isLoading={isLoading}>
          {isLoading ? 'Scanning...' : 'Scan Now'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Free scan — no account required. Limited to 5 scans per hour.
      </p>
    </form>
  );
}
