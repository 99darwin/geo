'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const URL_PATTERN = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;

interface HeroSearchProps {
  onUrlChange: (url: string) => void;
}

export function HeroSearch({ onUrlChange }: HeroSearchProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const submitCountRef = useRef(0);

  const hasInput = url.trim().length > 0;

  function handleChange(value: string) {
    setUrl(value);
    setError('');
    onUrlChange(value);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!URL_PATTERN.test(trimmed)) {
      setError('Enter a valid URL, e.g. yourbusiness.com');
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    const currentSubmit = ++submitCountRef.current;
    setIsScanning(true);
    setError('');

    try {
      const endpoint = session ? '/api/dashboard/scan' : '/api/scan';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (currentSubmit !== submitCountRef.current) return;

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem('scanResult', JSON.stringify(data.data));
        if (data.persisted !== undefined) {
          sessionStorage.setItem('scanPersisted', String(data.persisted));
        }
        router.push(`/scan?url=${encodeURIComponent(trimmed)}`);
        return;
      }

      if (response.status === 429) {
        setError('Rate limit reached. Try again in a few minutes.');
      } else if (response.status === 504 || response.status === 408) {
        setError('Scan timed out. The site may be slow — try again.');
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      if (currentSubmit !== submitCountRef.current) return;
      setError('Network error. Check your connection and try again.');
    } finally {
      if (currentSubmit === submitCountRef.current) {
        setIsScanning(false);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      {/* Inline layout on sm+, stacked on mobile */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-0">
        <div
          className={`relative flex items-center flex-1 rounded-xl sm:rounded-2xl border-2 bg-white shadow-xl shadow-black/[0.04] transition-all focus-within:shadow-2xl focus-within:shadow-indigo-500/[0.08] ${
            error
              ? 'border-red-300 focus-within:border-red-400'
              : 'border-gray-200 focus-within:border-indigo-400'
          }`}
        >
          <label htmlFor="hero-url-input" className="sr-only">
            Website URL
          </label>
          <input
            id="hero-url-input"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="yourbusiness.com"
            disabled={isScanning}
            aria-invalid={!!error}
            aria-describedby={error ? 'hero-url-error' : 'hero-url-hint'}
            className="flex-1 min-w-0 bg-transparent pl-4 sm:pl-5 pr-2 py-3.5 sm:py-4 text-base font-[family-name:var(--font-mono)] text-gray-900 placeholder:text-gray-300 focus:outline-none disabled:opacity-50"
          />
          {/* Button inside the input row on sm+ */}
          <button
            type="submit"
            disabled={!hasInput || isScanning}
            className={`hidden sm:block flex-shrink-0 mr-2 px-7 py-3.5 rounded-xl text-sm font-medium transition-all ${
              hasInput && !isScanning
                ? 'bg-gray-950 text-white hover:bg-gray-800 shadow-lg shadow-gray-950/20 active:translate-y-px'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isScanning ? (
              <span className="flex items-center gap-2">
                <svg className="motion-safe:animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                Scanning...
              </span>
            ) : (
              'Scan my site'
            )}
          </button>
        </div>

        {/* Full-width button on mobile */}
        <button
          type="submit"
          disabled={!hasInput || isScanning}
          className={`sm:hidden w-full py-4 rounded-xl text-sm font-medium transition-all ${
            hasInput && !isScanning
              ? 'bg-gray-950 text-white hover:bg-gray-800 shadow-lg shadow-gray-950/20 active:translate-y-px'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isScanning ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="motion-safe:animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Scanning...
            </span>
          ) : (
            'Scan my site'
          )}
        </button>
      </div>

      {error && (
        <p id="hero-url-error" role="alert" className="text-center text-xs text-red-500 mt-3">
          {error}
        </p>
      )}

      <p id="hero-url-hint" className={`text-center text-xs text-gray-400 mt-4 ${error ? 'sr-only' : ''}`}>
        Free scan — no signup required
      </p>
    </form>
  );
}
