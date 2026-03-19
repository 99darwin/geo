'use client';

interface DataPoint {
  period: string;
  score: number;
}

interface ScoreChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
}

const PADDING = { top: 20, right: 20, bottom: 40, left: 40 };
const GRID_LINES = [0, 25, 50, 75, 100];

export function ScoreChart({ data, width = 600, height = 250 }: ScoreChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        Score history will appear after your next monthly check.
      </div>
    );
  }

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const xStep = chartWidth / (data.length - 1);

  const points = data.map((d, i) => ({
    x: PADDING.left + i * xStep,
    y: PADDING.top + chartHeight - (d.score / 100) * chartHeight,
    ...d,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Gradient fill path
  const fillPath = [
    `M ${points[0].x},${PADDING.top + chartHeight}`,
    ...points.map((p) => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${PADDING.top + chartHeight}`,
    "Z",
  ].join(" ");

  const formatMonth = (period: string) => {
    const date = new Date(period);
    return date.toLocaleDateString("en-US", { month: "short" });
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {GRID_LINES.map((val) => {
        const y = PADDING.top + chartHeight - (val / 100) * chartHeight;
        return (
          <g key={val}>
            <line
              x1={PADDING.left}
              y1={y}
              x2={PADDING.left + chartWidth}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray={val === 0 ? undefined : "4 4"}
            />
            <text
              x={PADDING.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="#9ca3af"
            >
              {val}
            </text>
          </g>
        );
      })}

      {/* Fill area */}
      <path d={fillPath} fill="url(#scoreGradient)" />

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="rgb(99, 102, 241)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r="4"
            fill="white"
            stroke="rgb(99, 102, 241)"
            strokeWidth="2"
          />
          <title>{`${formatMonth(p.period)}: ${p.score}`}</title>

          {/* X-axis label */}
          <text
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fill="#9ca3af"
          >
            {formatMonth(p.period)}
          </text>
        </g>
      ))}
    </svg>
  );
}
