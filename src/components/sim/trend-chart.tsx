"use client";

import { useMemo, useRef } from "react";
import { FieldHelpTip, type FieldHelpContent } from "@/components/platform/field-help";

type Point = {
  x: number;
  y: number;
};

type AxisKey = "left" | "right";

type Series = {
  label: string;
  color: string;
  data: Point[];
  dashed?: boolean;
  axis?: AxisKey;
  help?: FieldHelpContent;
};

type AxisDomain = {
  minY: number;
  maxY: number;
};

type AxisConfig = {
  min?: number;
  max?: number;
  label?: string;
};

type ChartBand = {
  label: string;
  from: number;
  to: number;
  color: string;
  axis?: AxisKey;
};

export function interpolateSeriesValueAtX(data: Point[], x: number) {
  if (!data.length) {
    return null;
  }

  const points = [...data].sort((left, right) => left.x - right.x);
  const first = points[0];
  const last = points[points.length - 1];

  if (x < first.x || x > last.x) {
    return null;
  }

  if (points.length === 1) {
    return x === first.x ? first.y : null;
  }

  for (let index = 0; index < points.length; index += 1) {
    if (points[index].x === x) {
      return points[index].y;
    }
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    if (x >= previous.x && x <= next.x) {
      const span = next.x - previous.x;
      if (span === 0) {
        return next.y;
      }
      const ratio = (x - previous.x) / span;
      return previous.y + (next.y - previous.y) * ratio;
    }
  }

  return null;
}

export function formatCursorChartValue(value: number) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const absolute = Math.abs(value);
  const decimals = absolute >= 100 ? 1 : absolute >= 10 ? 2 : 3;
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export function resolveCursorLabelRows(
  rows: { y: number }[],
  top: number,
  bottom: number,
  minGap = 18
) {
  const ordered = rows
    .map((row, index) => ({ ...row, index, y: Math.min(bottom, Math.max(top, row.y)) }))
    .sort((left, right) => left.y - right.y);

  for (let index = 1; index < ordered.length; index += 1) {
    ordered[index].y = Math.max(ordered[index].y, ordered[index - 1].y + minGap);
  }

  const overflow = ordered.length ? ordered[ordered.length - 1].y - bottom : 0;
  if (overflow > 0) {
    ordered.forEach((row) => {
      row.y -= overflow;
    });
  }

  for (let index = ordered.length - 2; index >= 0; index -= 1) {
    ordered[index].y = Math.min(ordered[index].y, ordered[index + 1].y - minGap);
  }

  const underflow = ordered.length ? top - ordered[0].y : 0;
  if (underflow > 0) {
    ordered.forEach((row) => {
      row.y += underflow;
    });
  }

  const resolved = new Array(rows.length).fill(top);
  ordered.forEach((row) => {
    resolved[row.index] = row.y;
  });
  return resolved;
}

export function resolveAxisDomain(
  series: Series[],
  axis: AxisKey,
  explicit?: Pick<AxisConfig, "min" | "max">
): AxisDomain {
  if (Number.isFinite(explicit?.min) && Number.isFinite(explicit?.max)) {
    const minY = Number(explicit?.min);
    const maxY = Number(explicit?.max);
    return maxY === minY ? { minY, maxY: maxY + 1 } : { minY, maxY };
  }

  const points = series
    .filter((item) => (item.axis ?? "left") === axis)
    .flatMap((item) => item.data)
    .filter((point) => Number.isFinite(point.y));

  if (!points.length) {
    return { minY: 0, maxY: 1 };
  }

  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const yPad = Math.max((maxY - minY) * 0.12, 1);

  return maxY === minY ? { minY: minY - 1, maxY: maxY + 1 } : { minY: minY - yPad, maxY: maxY + yPad };
}

export function mapValueToChartY(value: number, domain: AxisDomain, top: number, bottom: number) {
  return bottom - ((value - domain.minY) / Math.max(domain.maxY - domain.minY, 1)) * (bottom - top);
}

export function resolveBandPlacement(
  from: number,
  to: number,
  domain: AxisDomain,
  top: number,
  bottom: number
) {
  const upper = Math.max(from, to);
  const lower = Math.min(from, to);
  const upperY = mapValueToChartY(upper, domain, top, bottom);
  const lowerY = mapValueToChartY(lower, domain, top, bottom);
  const y = Math.min(bottom, Math.max(top, upperY));
  const bandBottom = Math.min(bottom, Math.max(top, lowerY));

  return {
    y,
    height: Math.max(0, bandBottom - y)
  };
}

export function TrendChart({
  title,
  subtitle,
  series,
  rightAxis,
  bands = [],
  cursors,
  onPlaceCursor,
  activeCursor,
  svgRef
}: {
  title: string;
  subtitle?: string;
  series: Series[];
  rightAxis?: AxisConfig;
  bands?: ChartBand[];
  cursors?: { a: number | null; b: number | null; enabledTwo: boolean };
  onPlaceCursor?: (time: number) => void;
  activeCursor?: "a" | "b";
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const internalRef = useRef<SVGSVGElement | null>(null);
  const ref = svgRef ?? internalRef;
  const cursorState = cursors ?? { a: null, b: null, enabledTwo: false };
  const chart = useMemo(() => {
    const allPoints = series.flatMap((item) => item.data);
    const minX = allPoints.length ? Math.min(...allPoints.map((point) => point.x)) : 0;
    const maxX = allPoints.length ? Math.max(...allPoints.map((point) => point.x)) : 1;
    const leftDomain = resolveAxisDomain(series, "left");
    const rightDomain = rightAxis ? resolveAxisDomain(series, "right", rightAxis) : null;

    return {
      minX,
      maxX: maxX === minX ? maxX + 1 : maxX,
      leftDomain,
      rightDomain
    };
  }, [rightAxis, series]);

  const width = 960;
  const height = 320;
  const padding = { top: 28, right: rightAxis ? 64 : 20, bottom: 38, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const plotRight = width - padding.right;
  const plotBottom = height - padding.bottom;

  const mapPoint = (point: Point, axis: AxisKey = "left") => {
    const domain = axis === "right" && chart.rightDomain ? chart.rightDomain : chart.leftDomain;
    const x =
      padding.left +
      ((point.x - chart.minX) / Math.max(chart.maxX - chart.minX, 1)) * plotWidth;
    const y = mapValueToChartY(point.y, domain, padding.top, plotBottom);
    return `${x},${y}`;
  };

  const mapX = (time: number) =>
    padding.left + ((time - chart.minX) / Math.max(chart.maxX - chart.minX, 1)) * plotWidth;

  const mapY = (value: number, axis: AxisKey = "left") =>
    mapValueToChartY(value, axis === "right" && chart.rightDomain ? chart.rightDomain : chart.leftDomain, padding.top, plotBottom);

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!onPlaceCursor || !ref.current) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const normalized = (localX - padding.left) / Math.max(rect.width - padding.left - padding.right, 1);
    const clampedNormalized = Math.min(1, Math.max(0, normalized));
    const time = chart.minX + clampedNormalized * (chart.maxX - chart.minX);
    onPlaceCursor(time);
  };

  const renderCursor = (time: number, label: string, color: string) => {
    const x = mapX(time);
    const cursorValues = series
      .map((item) => {
        const value = interpolateSeriesValueAtX(item.data, time);
        return value === null
          ? null
          : { label: item.label, color: item.color, value, y: mapY(value, item.axis ?? "left") };
      })
      .filter((item): item is { label: string; color: string; value: number; y: number } => item !== null);
    const rowYs = resolveCursorLabelRows(
      cursorValues.map((item) => ({ y: item.y })),
      padding.top + 12,
      plotBottom - 10
    );
    const longestLabel = cursorValues.reduce(
      (longest, item) => Math.max(longest, `${item.label} ${formatCursorChartValue(item.value)}`.length),
      0
    );
    const rowWidth = Math.min(220, Math.max(92, longestLabel * 6.2 + 30));
    const rowOnRight = x <= plotRight - rowWidth - 12;
    const rowX = rowOnRight ? x + 8 : x - rowWidth - 8;
    const timeWidth = 74;
    const timeX = Math.min(plotRight - timeWidth, Math.max(padding.left, x - timeWidth / 2));

    return (
      <g key={label}>
        <line
          x1={x}
          x2={x}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={color}
          strokeWidth={2}
        />
        <rect x={timeX} y="5" width={timeWidth} height="17" rx="5" fill="rgba(15,23,42,.92)" stroke={color} />
        <text x={timeX + timeWidth / 2} y="17" textAnchor="middle" fill={color} fontSize={11} fontWeight={700}>
          {label} {time.toFixed(1)}s
        </text>
        {cursorValues.map((item, index) => (
          <g key={`${label}-${item.label}`} transform={`translate(${rowX} ${rowYs[index] - 9})`}>
            <rect width={rowWidth} height="18" rx="5" fill="rgba(15,23,42,.92)" stroke="rgba(148,163,184,.28)" />
            <circle cx="10" cy="9" r="3.5" fill={item.color} />
            <text x="18" y="12.5" fill="rgba(248,250,252,.95)" fontSize={11} fontWeight={700}>
              {item.label} {formatCursorChartValue(item.value)}
            </text>
          </g>
        ))}
      </g>
    );
  };

  return (
    <article className="chart-card">
      <div className="chip-row">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {activeCursor ? <span className="pill info">Next cursor: {activeCursor.toUpperCase()}</span> : null}
      </div>

      <div className="legend">
        {series.map((item) => (
          <span key={item.label} className="legend-item">
            <span className="legend-swatch" style={{ background: item.color }} />
            <span>{item.label}</span>
            {item.help ? <FieldHelpTip help={item.help} /> : null}
          </span>
        ))}
      </div>

      <div className="chart-surface">
        <svg
          ref={ref}
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={title}
          onClick={handleClick}
        >
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = padding.top + ratio * plotHeight;
            return (
              <line
                key={ratio}
                x1={padding.left}
                x2={plotRight}
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,.16)"
                strokeWidth={1}
              />
            );
          })}

          <line
            x1={padding.left}
            x2={padding.left}
            y1={padding.top}
            y2={plotBottom}
            stroke="rgba(148,163,184,.28)"
          />
          {rightAxis ? (
            <line
              x1={plotRight}
              x2={plotRight}
              y1={padding.top}
              y2={plotBottom}
              stroke="rgba(148,163,184,.28)"
            />
          ) : null}
          <line
            x1={padding.left}
            x2={plotRight}
            y1={plotBottom}
            y2={plotBottom}
            stroke="rgba(148,163,184,.28)"
          />

          {bands.map((band) => {
            const domain =
              (band.axis ?? "left") === "right" && chart.rightDomain ? chart.rightDomain : chart.leftDomain;
            const placement = resolveBandPlacement(band.from, band.to, domain, padding.top, plotBottom);
            if (placement.height <= 0) {
              return null;
            }
            return (
              <g key={band.label}>
                <rect
                  x={padding.left}
                  y={placement.y}
                  width={plotWidth}
                  height={placement.height}
                  fill={band.color}
                  opacity={0.2}
                />
                <text
                  x={plotRight - 8}
                  y={Math.max(padding.top + 12, placement.y + 12)}
                  fill="rgba(248,250,252,.75)"
                  fontSize={11}
                  textAnchor="end"
                >
                  {band.label}
                </text>
              </g>
            );
          })}

          {series.map((item) => (
            <polyline
              key={item.label}
              fill="none"
              stroke={item.color}
              strokeWidth={2.2}
              strokeDasharray={item.dashed ? "8 6" : undefined}
              points={item.data.map((point) => mapPoint(point, item.axis ?? "left")).join(" ")}
            />
          ))}

          <text x={padding.left} y={height - 10} fill="rgba(148,163,184,.8)" fontSize={12}>
            {chart.minX.toFixed(0)}s
          </text>
          <text x={plotRight} y={height - 10} fill="rgba(148,163,184,.8)" fontSize={12} textAnchor="end">
            {chart.maxX.toFixed(0)}s
          </text>
          <text x={12} y={padding.top + 10} fill="rgba(148,163,184,.8)" fontSize={12}>
            {chart.leftDomain.maxY.toFixed(1)}
          </text>
          <text x={12} y={plotBottom} fill="rgba(148,163,184,.8)" fontSize={12}>
            {chart.leftDomain.minY.toFixed(1)}
          </text>
          {rightAxis && chart.rightDomain ? (
            <>
              <text x={width - 10} y={padding.top + 10} fill="rgba(148,163,184,.8)" fontSize={12} textAnchor="end">
                {chart.rightDomain.maxY.toFixed(1)}
              </text>
              <text x={width - 10} y={plotBottom} fill="rgba(148,163,184,.8)" fontSize={12} textAnchor="end">
                {chart.rightDomain.minY.toFixed(1)}
              </text>
              {rightAxis.label ? (
                <text x={width - 10} y={padding.top - 8} fill="rgba(148,163,184,.8)" fontSize={11} textAnchor="end">
                  {rightAxis.label}
                </text>
              ) : null}
            </>
          ) : null}

          {cursorState.a !== null ? renderCursor(cursorState.a, "A", "#fb7185") : null}
          {cursorState.enabledTwo && cursorState.b !== null ? renderCursor(cursorState.b, "B", "#38bdf8") : null}
        </svg>
      </div>
    </article>
  );
}
