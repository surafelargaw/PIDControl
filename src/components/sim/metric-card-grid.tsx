import type { RunMetrics } from "@/lib/sim/types";

function formatNullable(value: number | null, suffix = "s") {
  return value === null ? "n/a" : `${value.toFixed(1)}${suffix}`;
}

export function MetricCardGrid({ metrics }: { metrics: RunMetrics }) {
  const cards = [
    { label: "Current Error", value: metrics.currentError.toFixed(2) },
    { label: "PV Span Seen", value: metrics.pvRange.toFixed(2) },
    { label: "CO Travel", value: `${metrics.coTravel.toFixed(0)}%` },
    { label: "Valve Travel", value: `${metrics.valveTravel.toFixed(0)}%` },
    { label: "Rise Time", value: formatNullable(metrics.riseTime) },
    { label: "Settling Time", value: formatNullable(metrics.settlingTime) },
    { label: "Overshoot", value: `${metrics.overshootPct.toFixed(1)}%` },
    { label: "Steady-State Offset", value: metrics.steadyStateOffset.toFixed(2) },
    { label: "IAE", value: metrics.iae.toFixed(2) },
    { label: "ISE", value: metrics.ise.toFixed(2) },
    { label: "ITAE", value: metrics.itae.toFixed(2) },
    { label: "Recovery", value: formatNullable(metrics.disturbanceRecoveryTime) }
  ];

  return (
    <div className="metrics-grid">
      {cards.map((card) => (
        <article key={card.label} className="metric-card">
          <p className="eyebrow">{card.label}</p>
          <h3>{card.value}</h3>
        </article>
      ))}
    </div>
  );
}
