'use client';

import { useCallback, useState } from 'react';
import { BeforeAfterSlider } from './before-after-slider';
import { TypingHeadline, useTypingAnimation } from './typing-animation';
import { HeroSearch } from './hero-search';
import { BUSINESSES, GENERIC_COMPETITORS } from './business-data';

function extractBusinessName(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let domain = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');

  domain = domain.split('/')[0];
  domain = domain.replace(/\.[a-z]{2,}(\.[a-z]{2,})?$/, '');

  if (!domain) return null;

  const words = domain
    .split(/[-.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return words.join(' ') || null;
}

export function Hero() {
  const [urlInput, setUrlInput] = useState('');

  const overrideName = extractBusinessName(urlInput);
  const { displayText, businessIndex } = useTypingAnimation(overrideName ?? undefined);
  const businessName = overrideName ?? (displayText || BUSINESSES[0].name);

  const competitors = overrideName
    ? GENERIC_COMPETITORS
    : BUSINESSES[businessIndex].competitors;

  const handleUrlChange = useCallback((url: string) => {
    setUrlInput(url);
  }, []);

  return (
    <section className="relative overflow-hidden hero-grain">
      <div className="absolute inset-0 bg-[#FAFAF8]" aria-hidden="true" />
      <div
        className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-20">
        <div className="grid lg:grid-cols-[1fr,1fr] gap-8 lg:gap-12 items-center">
          <div className="flex flex-col">
            <p className="text-xs font-medium tracking-wider uppercase text-indigo-600/80 mb-4 font-[family-name:var(--font-mono)]">
              AI search visibility
            </p>
            <TypingHeadline businessName={businessName} override={overrideName ?? undefined} />
            <p className="text-base text-gray-500 leading-relaxed mt-5 mb-8 max-w-[38ch]">
              When someone asks ChatGPT for a recommendation, do they find you — or your competitor?
            </p>
            <HeroSearch onUrlChange={handleUrlChange} />
          </div>

          <div>
            <BeforeAfterSlider businessName={businessName} competitors={competitors} />
          </div>
        </div>
      </div>
    </section>
  );
}
