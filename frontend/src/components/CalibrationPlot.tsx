import React from 'react';

interface Bin { predicted: number; observed: number; n: number }

const S = 260, M = 34;

/** Reliability diagram: mean predicted probability vs observed rate per quantile bin (out-of-fold). */
export const CalibrationPlot: React.FC<{ bins: Bin[] }> = ({ bins }) => {
  const x = (v: number) => M + v * (S - 2 * M);
  const y = (v: number) => S - M - v * (S - 2 * M);
  const pts = bins.map(b => `${x(b.predicted).toFixed(1)},${y(b.observed).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="chart-svg" style={{ width: '100%', maxWidth: 320, height: 'auto', margin: '0 auto' }} role="img"
      aria-label={`Calibration: ${bins.map(b => `predicted ${Math.round(b.predicted * 100)}%, observed ${Math.round(b.observed * 100)}% (n=${b.n})`).join('; ')}`}>
      {[0, 0.5, 1].map(v => (
        <g key={v}>
          <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={x(0) - 6} y={y(v)} className="chart-tick" textAnchor="end" dominantBaseline="middle">{v * 100}%</text>
          <text x={x(v)} y={S - M + 16} className="chart-tick" textAnchor="middle">{v * 100}%</text>
        </g>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="chart-threshold" />
      <polyline points={pts} fill="none" className="chart-obs-line" />
      {bins.map(b => (
        <g key={b.predicted}>
          <circle cx={x(b.predicted)} cy={y(b.observed)} r={4.5} className="chart-obs-dot"><title>{`Predicted ${(b.predicted * 100).toFixed(0)}%, observed ${(b.observed * 100).toFixed(0)}%, n = ${b.n}`}</title></circle>
        </g>
      ))}
      <text x={x(0.5)} y={S - 4} className="chart-annot" textAnchor="middle">Predicted probability</text>
      <text x={10} y={y(0.5)} className="chart-annot" textAnchor="middle" transform={`rotate(-90 10 ${y(0.5)})`}>Observed rate</text>
    </svg>
  );
};
