import React from 'react';
import { EngraftmentCurve } from '../types';

interface Series { id: number; name: string; curve: EngraftmentCurve }

const W = 640, H = 230, M = { top: 12, right: 120, bottom: 28, left: 40 };

/** Cumulative probability of neutrophil engraftment by day, one line per donor/graft option. */
export const EngraftmentCurves: React.FC<{ series: Series[] }> = ({ series }) => {
  if (!series.length) return null;
  const maxDay = 35;
  const x = (d: number) => M.left + (d / maxDay) * (W - M.left - M.right);
  const y = (p: number) => M.top + (1 - p) * (H - M.top - M.bottom);
  // Stagger end labels so they never overlap.
  const ends = series
    .map((s, i) => ({ i, y: y(s.curve.probability_engrafted[maxDay] ?? 1) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 14);
  const labelY = Object.fromEntries(ends.map(e => [e.i, e.y]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" style={{ width: '100%', height: 'auto' }} role="img"
      aria-label={`Probability of neutrophil engraftment by day for ${series.map(s => `${s.name} (median Day ${s.curve.median_day})`).join(', ')}`}>
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <g key={p}>
          <line x1={M.left} x2={W - M.right} y1={y(p)} y2={y(p)} className="chart-grid" />
          <text x={M.left - 6} y={y(p)} className="chart-tick" textAnchor="end" dominantBaseline="middle">{p * 100}%</text>
        </g>
      ))}
      {[0, 7, 14, 21, 28, 35].map(d => (
        <text key={d} x={x(d)} y={H - 8} className="chart-tick" textAnchor="middle">{d === 0 ? 'Day 0' : `+${d}`}</text>
      ))}
      <line x1={x(14)} x2={x(14)} y1={M.top} y2={H - M.bottom} className="chart-threshold" />
      {series.map((s, i) => {
        const pts = s.curve.days.filter(d => d <= maxDay).map(d => `${x(d).toFixed(1)},${y(s.curve.probability_engrafted[d]).toFixed(1)}`);
        return (
          <g key={s.id} className={`series-${i % 4}`}>
            <polyline points={pts.join(' ')} fill="none" className="series-line" />
            <text x={W - M.right + 6} y={labelY[i]} className="chart-annot series-label" dominantBaseline="middle">{s.name}</text>
          </g>
        );
      })}
    </svg>
  );
};
