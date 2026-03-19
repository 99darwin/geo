'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';

type Competitor = { name: string; rating: string; reviews: string; desc: string };

const MockResponse = memo(function MockResponse({ businessName, competitors, highlighted }: { businessName: string; competitors: [Competitor, Competitor, Competitor]; highlighted: boolean }) {
  const results = highlighted
    ? [
        { name: businessName, rating: '4.9', reviews: '428', desc: 'Trusted local favorite known for exceptional care and a welcoming environment.', isHighlighted: true },
        competitors[0],
        competitors[1],
      ]
    : competitors;

  return (
    <div className="absolute inset-0 flex flex-col bg-white text-gray-900 p-3.5 sm:p-5 md:p-6 overflow-hidden" aria-hidden="true">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-900 flex-shrink-0" />
        <span className="text-[0.6875rem] sm:text-xs text-gray-500 font-medium">AI Assistant</span>
      </div>

      <p className="text-[0.6875rem] sm:text-xs text-gray-500 mb-2 sm:mb-3 leading-normal">
        Here are the top-rated options I&apos;d recommend in your area:
      </p>

      <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-h-0">
        {results.map((r, i) => {
          const isHero = 'isHighlighted' in r && r.isHighlighted;
          return (
            <div
              key={i}
              className={`rounded-lg px-2.5 py-2 sm:px-3.5 sm:py-2.5 ${
                isHero
                  ? 'bg-indigo-50 border border-indigo-200'
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              <div className="flex items-baseline justify-between gap-1 sm:gap-2">
                <div className="flex items-baseline gap-1.5 sm:gap-2 min-w-0">
                  <span className="text-[0.625rem] sm:text-[0.6875rem] text-gray-400 font-[family-name:var(--font-mono)] tabular-nums flex-shrink-0">
                    {i + 1}.
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-medium truncate ${
                      isHero ? 'text-indigo-700' : 'text-gray-800'
                    }`}
                  >
                    {r.name}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                  <span className="text-amber-500 text-[0.625rem] sm:text-[0.6875rem]" aria-hidden="true">★</span>
                  <span className="text-[0.625rem] sm:text-xs text-gray-500 tabular-nums">
                    {r.rating}
                    <span className="text-gray-400 ml-0.5 hidden sm:inline">({r.reviews})</span>
                  </span>
                </div>
              </div>
              <p className="text-[0.625rem] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 line-clamp-1 pl-4 sm:pl-5 hidden sm:block">
                {r.desc}
              </p>
            </div>
          );
        })}
      </div>

      {!highlighted && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
          <p className="text-[0.6875rem] sm:text-xs text-red-600/70 flex items-center gap-1 sm:gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0 sm:w-[14px] sm:h-[14px]">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="truncate">{businessName} not found in AI results</span>
          </p>
        </div>
      )}

      {highlighted && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
          <p className="text-[0.6875rem] sm:text-xs text-emerald-700/70 flex items-center gap-1 sm:gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0 sm:w-[14px] sm:h-[14px]">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="truncate">{businessName} is the #1 AI result</span>
          </p>
        </div>
      )}
    </div>
  );
});

interface BeforeAfterSliderProps {
  businessName: string;
  competitors: [Competitor, Competitor, Competitor];
}

const STEP = 5;
const MIN_POS = 5;
const MAX_POS = 95;
const clamp = (v: number) => Math.max(MIN_POS, Math.min(MAX_POS, v));

export function BeforeAfterSlider({ businessName, competitors }: BeforeAfterSliderProps) {
  const [ariaPos, setAriaPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(50);
  const animFrameRef = useRef(0);
  const prefersReducedMotion = useRef(false);

  const applyPosition = useCallback((pos: number) => {
    const el = containerRef.current;
    if (!el) return;
    posRef.current = pos;
    el.style.setProperty('--pos', `${pos}%`);
    el.style.setProperty('--pos-inv', `${100 - pos}%`);
    el.style.setProperty('--label-before-opacity', pos > 15 ? '1' : '0');
    el.style.setProperty('--label-after-opacity', pos < 85 ? '1' : '0');
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotion.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    applyPosition(50);
  }, [applyPosition]);

  useEffect(() => {
    if (hasInteracted || prefersReducedMotion.current) return;

    const start = Date.now();
    let raf: number;
    const animate = () => {
      const elapsed = (Date.now() - start) / 1000;
      applyPosition(50 + Math.sin(elapsed * 0.8) * 20);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [hasInteracted, applyPosition]);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    applyPosition(clamp((x / rect.width) * 100));
  }, [applyPosition]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setHasInteracted(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      updatePosition(e.clientX);
    });
  }, [isDragging, updatePosition]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setAriaPos(Math.round(posRef.current));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let newPos: number | null = null;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        newPos = clamp(posRef.current - STEP);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        newPos = clamp(posRef.current + STEP);
        break;
      case 'Home':
        newPos = MIN_POS;
        break;
      case 'End':
        newPos = MAX_POS;
        break;
      default:
        return;
    }

    e.preventDefault();
    setHasInteracted(true);
    applyPosition(newPos);
    setAriaPos(Math.round(newPos));
  }, [applyPosition]);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    setHasInteracted(true);
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pos = clamp(((e.clientX - rect.left) / rect.width) * 100);
    applyPosition(pos);
    setAriaPos(Math.round(pos));
  }, [isDragging, applyPosition]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-lg shadow-gray-900/[0.08] border border-gray-200 h-[320px] sm:h-[380px]"
        style={{
          '--pos': '50%',
          '--pos-inv': '50%',
          '--label-before-opacity': '1',
          '--label-after-opacity': '1',
        } as React.CSSProperties}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleContainerClick}
      >
        {/* Labels */}
        <div
          className="absolute top-3 left-3 z-20 transition-opacity duration-200"
          style={{ opacity: 'var(--label-before-opacity)' }}
        >
          <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-red-600/80 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/60">
            Before
          </span>
        </div>
        <div
          className="absolute top-3 right-3 z-20 transition-opacity duration-200"
          style={{ opacity: 'var(--label-after-opacity)' }}
        >
          <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-emerald-700/80 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
            After
          </span>
        </div>

        {/* AFTER layer (full, sits behind) */}
        <MockResponse businessName={businessName} competitors={competitors} highlighted={true} />

        {/* BEFORE layer (clipped via CSS var) */}
        <div
          className="absolute inset-0 z-10"
          style={{ clipPath: 'inset(0 var(--pos-inv) 0 0)' }}
        >
          <MockResponse businessName={businessName} competitors={competitors} highlighted={false} />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 z-20 w-px bg-gray-300 will-change-transform"
          style={{ left: 'var(--pos)', transform: 'translateX(-50%)' }}
        />

        {/* Drag handle */}
        <div
          className={`absolute top-1/2 z-30 -translate-y-1/2 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-md shadow-gray-900/20 border border-gray-200 select-none will-change-transform motion-safe:transition-[transform] motion-safe:duration-100 ${
            isDragging ? 'scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
          style={{ left: 'var(--pos)', transform: 'translate(-50%, -50%)' }}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          role="slider"
          aria-valuenow={ariaPos}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Before and after comparison. Move left to see before, right to see after."
          aria-valuetext={`Showing ${ariaPos}% after view`}
          tabIndex={0}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M8 4l-6 8 6 8" />
            <path d="M16 4l6 8-6 8" />
          </svg>
        </div>
      </div>

      <p
        className={`text-center text-xs text-gray-400 mt-2.5 motion-safe:transition-opacity ${hasInteracted ? 'opacity-0' : 'opacity-100'}`}
        aria-hidden={hasInteracted}
      >
        Drag to compare
      </p>
    </div>
  );
}
