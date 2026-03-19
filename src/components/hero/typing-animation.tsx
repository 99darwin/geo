'use client';

import { useEffect, useRef, useState } from 'react';
import { BUSINESS_NAMES, LONGEST_NAME } from './business-data';

const TYPE_SPEED = 70;
const DELETE_SPEED = 40;
const PAUSE_AFTER_TYPE = 2200;
const PAUSE_AFTER_DELETE = 400;

export function useTypingAnimation(override?: string) {
  const [displayText, setDisplayText] = useState('');
  const [businessIndex, setBusinessIndex] = useState(0);
  const indexRef = useRef(0);
  const phaseRef = useRef<'typing' | 'paused' | 'deleting' | 'pauseAfterDelete'>('typing');
  const charRef = useRef(0);

  useEffect(() => {
    if (override) {
      setDisplayText(override);
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayText(BUSINESS_NAMES[indexRef.current]);
      setBusinessIndex(indexRef.current);
      const interval = setInterval(() => {
        indexRef.current = (indexRef.current + 1) % BUSINESS_NAMES.length;
        setDisplayText(BUSINESS_NAMES[indexRef.current]);
        setBusinessIndex(indexRef.current);
      }, PAUSE_AFTER_TYPE + 1000);
      return () => clearInterval(interval);
    }

    let timeout: NodeJS.Timeout;

    const tick = () => {
      const currentWord = BUSINESS_NAMES[indexRef.current];

      switch (phaseRef.current) {
        case 'typing': {
          if (charRef.current < currentWord.length) {
            charRef.current++;
            setDisplayText(currentWord.slice(0, charRef.current));
            timeout = setTimeout(tick, TYPE_SPEED);
          } else {
            phaseRef.current = 'paused';
            timeout = setTimeout(tick, PAUSE_AFTER_TYPE);
          }
          break;
        }
        case 'paused': {
          phaseRef.current = 'deleting';
          timeout = setTimeout(tick, DELETE_SPEED);
          break;
        }
        case 'deleting': {
          if (charRef.current > 0) {
            charRef.current--;
            setDisplayText(currentWord.slice(0, charRef.current));
            timeout = setTimeout(tick, DELETE_SPEED);
          } else {
            phaseRef.current = 'pauseAfterDelete';
            timeout = setTimeout(tick, PAUSE_AFTER_DELETE);
          }
          break;
        }
        case 'pauseAfterDelete': {
          indexRef.current = (indexRef.current + 1) % BUSINESS_NAMES.length;
          setBusinessIndex(indexRef.current);
          phaseRef.current = 'typing';
          timeout = setTimeout(tick, TYPE_SPEED);
          break;
        }
      }
    };

    timeout = setTimeout(tick, TYPE_SPEED);
    return () => clearTimeout(timeout);
  }, [override]);

  return { displayText, businessIndex };
}

export function TypingHeadline({ businessName, override }: { businessName: string; override?: string }) {
  const showCursor = !override;

  return (
    <h1 className="text-[clamp(2rem,6vw,3.25rem)] font-bold tracking-tight text-gray-950 leading-[1.1]">
      <span className="block">Make</span>
      <span className="relative inline-block align-bottom" aria-label={businessName}>
        <span className="invisible whitespace-normal sm:whitespace-nowrap" aria-hidden="true">{override || LONGEST_NAME}</span>
        <span className="absolute left-0 top-0 whitespace-normal sm:whitespace-nowrap" aria-hidden="true">
          <span className="relative">
            {businessName}
            <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-indigo-500/30 rounded-full" aria-hidden="true" />
          </span>
          {showCursor && (
            <span className="inline-block w-[2px] h-[0.85em] bg-indigo-500 ml-0.5 align-baseline motion-safe:animate-blink" />
          )}
        </span>
      </span>
      <span className="block text-[0.6em] font-medium text-gray-400 mt-1 tracking-normal">
        visible to AI
      </span>
    </h1>
  );
}
