import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrajectoryPoint } from '../types';

export type TrajectoryMetric = 'anc' | 'plt';

interface TrajectoryChartProps {
  points: TrajectoryPoint[];
  metric: TrajectoryMetric;
  latestDay: number;
  threshold: number;
  thresholdLabel: string;
  projectedDay?: number;
  height?: number;
}

const META: Record<TrajectoryMetric, { label: string; unit: string; min: number; max: number; ticks: number[] }> = {
  anc: { label: 'Neutrophils (ANC)', unit: 'cells/µL', min: 10, max: 5000, ticks: [10, 100, 1000] },
  plt: { label: 'Platelets', unit: '/µL', min: 5000, max: 300000, ticks: [10000, 100000] }
};

const M = { top: 16, right: 18, bottom: 30, left: 52 };

const fmt = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}K` : v.toLocaleString('en-US'));

/** Log-scale recovery chart: observed draws, model fit and its 95% band, threshold and today marker. */
export const TrajectoryChart: React.FC<TrajectoryChartProps> = ({
  points, metric, latestDay, threshold, thresholdLabel, projectedDay, height = 300
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const meta = META[metric];
  const get = (p: TrajectoryPoint) => ({
    obs: metric === 'anc' ? p.anc_observed : p.plt_observed,
    pred: metric === 'anc' ? p.anc_predicted : p.plt_predicted,
    lo: metric === 'anc' ? p.anc_lower_95 : p.plt_lower_95,
    hi: metric === 'anc' ? p.anc_upper_95 : p.plt_upper_95
  });

  const geo = useMemo(() => {
    const innerW = width - M.left - M.right;
    const innerH = height - M.top - M.bottom;
    const d0 = points[0]?.day ?? 0;
    const d1 = points[points.length - 1]?.day ?? 30;
    const x = (d: number) => M.left + ((d - d0) / Math.max(1, d1 - d0)) * innerW;
    const lMin = Math.log10(meta.min);
    const lMax = Math.log10(meta.max);
    const y = (v: number) => M.top + (1 - (Math.log10(Math.min(meta.max, Math.max(meta.min, v))) - lMin) / (lMax - lMin)) * innerH;
    return { innerW, innerH, d0, d1, x, y };
  }, [width, height, points, meta]);

  const { x, y, d0, d1 } = geo;
  const series = points.map(p => ({ day: p.day, ...get(p) }));
  const observed = series.filter(s => s.obs != null) as { day: number; obs: number }[];
  const linePath = (key: 'pred' | 'obs', rows: { day: number; [k: string]: number | undefined }[]) =>
    rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.day).toFixed(1)},${y(r[key] as number).toFixed(1)}`).join('');
  const band = series.length
    ? `${series.map((s, i) => `${i ? 'L' : 'M'}${x(s.day).toFixed(1)},${y(s.hi).toFixed(1)}`).join('')}${[...series].reverse().map(s => `L${x(s.day).toFixed(1)},${y(s.lo).toFixed(1)}`).join('')}Z`
    : '';

  const xStep = d1 - d0 > 60 ? 14 : 7;
  const xTicks: number[] = [];
  for (let d = Math.ceil(d0 / xStep) * xStep; d <= d1; d += xStep) xTicks.push(d);

  const hovered = hover != null ? series.find(s => s.day === hover) : null;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const day = Math.round(d0 + ((px - M.left) / geo.innerW) * (d1 - d0));
    setHover(Math.min(d1, Math.max(d0, day)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setHover(h => Math.min(d1, Math.max(d0, (h ?? latestDay) + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  const last = observed[observed.length - 1];

  return (
    <div ref={wrapRef} className="chart-wrap">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${meta.label} by day after transplant, log scale. Latest observed ${last ? fmt(last.obs) : 'none'} ${meta.unit} on day ${latestDay}. Threshold ${fmt(threshold)}.`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        className="chart-svg"
      >
        {/* Grid & axes */}
        {meta.ticks.map(t => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={M.left - 8} y={y(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">{fmt(t)}</text>
          </g>
        ))}
        {xTicks.map(d => (
          <text key={d} x={x(d)} y={height - 8} className="chart-tick" textAnchor="middle">{d === 0 ? 'Day 0' : `+${d}`}</text>
        ))}
        <line x1={M.left} x2={width - M.right} y1={height - M.bottom} y2={height - M.bottom} className="chart-axis" />

        {/* Forecast region after the latest draw */}
        <rect x={x(latestDay)} y={M.top} width={Math.max(0, width - M.right - x(latestDay))} height={geo.innerH} className="chart-future" />

        {/* 95% band + model */}
        <path d={band} className="chart-band" />
        <path d={linePath('pred', series)} className="chart-model" />

        {/* Threshold */}
        <line x1={M.left} x2={width - M.right} y1={y(threshold)} y2={y(threshold)} className="chart-threshold" />
        <text x={width - M.right - 4} y={y(threshold) - 6} className="chart-annot" textAnchor="end">{thresholdLabel}</text>

        {/* Today */}
        <line x1={x(latestDay)} x2={x(latestDay)} y1={M.top} y2={height - M.bottom} className="chart-today" />
        <text x={x(latestDay) + 5} y={M.top + 10} className="chart-annot">Today · Day +{latestDay}</text>

        {projectedDay != null && projectedDay > latestDay && projectedDay <= d1 && (
          <g>
            <circle cx={x(projectedDay)} cy={y(threshold)} r={5} className="chart-projected" />
            {/* Too close to today, the label would collide with the latest value; the marker and KPI carry it. */}
            {projectedDay - latestDay >= 4 && (
              <text x={x(projectedDay)} y={y(threshold) + 18} className="chart-annot" textAnchor="middle">Projected +{projectedDay}</text>
            )}
          </g>
        )}

        {/* Observed draws */}
        {observed.length > 1 && <path d={linePath('obs', observed)} className="chart-obs-line" />}
        {observed.map(o => (
          <circle key={o.day} cx={x(o.day)} cy={y(o.obs)} r={4.5} className="chart-obs-dot" />
        ))}
        {last && <text x={x(last.day) - 8} y={y(last.obs) - 10} className="chart-value" textAnchor="end">{fmt(last.obs)}</text>}

        {/* Crosshair */}
        {hovered && (
          <g pointerEvents="none">
            <line x1={x(hovered.day)} x2={x(hovered.day)} y1={M.top} y2={height - M.bottom} className="chart-crosshair" />
            <circle cx={x(hovered.day)} cy={y(hovered.obs ?? hovered.pred)} r={5} className={hovered.obs != null ? 'chart-obs-dot' : 'chart-model-dot'} />
          </g>
        )}

        <rect
          x={M.left}
          y={M.top}
          width={geo.innerW}
          height={geo.innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hovered && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(width - 190, Math.max(0, x(hovered.day) + 12)), top: M.top + 6 }}
          role="status"
        >
          <div className="tiny faint">Day {hovered.day >= 0 ? `+${hovered.day}` : hovered.day}{hovered.day > latestDay ? ' · forecast' : ''}</div>
          {hovered.obs != null && (
            <div className="tt-row"><span className="tt-key obs" /><strong>{fmt(hovered.obs)}</strong><span className="muted">observed</span></div>
          )}
          <div className="tt-row"><span className="tt-key model" /><strong>{fmt(hovered.pred)}</strong><span className="muted">model</span></div>
          <div className="tiny muted">95% band {fmt(hovered.lo)} – {fmt(hovered.hi)}</div>
        </div>
      )}
    </div>
  );
};
