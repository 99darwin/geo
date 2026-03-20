'use client';

import { useEffect, useRef, useState } from 'react';

interface ScoreGaugeProps {
  score: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score <= 30) return '#ef4444'; // red-500
  if (score <= 60) return '#eab308'; // yellow-500
  return '#22c55e'; // green-500
}

function getScoreLabel(score: number): string {
  if (score <= 30) return 'Poor';
  if (score <= 60) return 'Fair';
  return 'Good';
}

export function ScoreGauge({ score, size = 160 }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const rafRef = useRef<number>(0);

  useEffect(() => {
    const duration = 1000;
    let start: number | null = null;

    function tick(timestamp: number) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setAnimatedScore(Math.round(eased * score));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score]);

  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;
  const color = getScoreColor(score);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`Visibility score: ${score} out of 100, rated ${getScoreLabel(score)}`}
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-100"
        />
      </svg>
      {/* Score text overlaid in center */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden="true"
      >
        <span className="font-bold text-gray-900" style={{ fontSize: size * 0.225 }}>
          {animatedScore}
        </span>
        <span className="text-gray-500" style={{ fontSize: size * 0.09 }}>{getScoreLabel(score)}</span>
      </div>
      </div>
    </div>
  );
}
