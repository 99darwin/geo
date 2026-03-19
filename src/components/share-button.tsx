'use client';

import { useState } from 'react';
import type { ScanResult } from '@/types';
import { Button } from '@/components/ui/button';

interface ShareButtonProps {
  result: ScanResult;
}

export function ShareButton({ result }: ShareButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');

  async function handleShare() {
    setState('loading');

    try {
      const res = await fetch('/api/reports/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: result }),
      });

      if (!res.ok) {
        setState('error');
        return;
      }

      const json = await res.json();
      const shareUrl = json.data.url;

      await navigator.clipboard.writeText(shareUrl);
      setState('copied');
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleShare}
      isLoading={state === 'loading'}
      disabled={state === 'loading'}
    >
      {state === 'copied' && (
        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === 'error' && (
        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {state !== 'copied' && state !== 'error' && (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
      {state === 'copied' ? 'Link Copied!' : state === 'error' ? 'Failed' : 'Share Report'}
    </Button>
  );
}
