"use client";

import { useMemo, useState } from "react";
import { buildWindupTeachingSnapshot } from "./mini-sim";
import { WidgetChart } from "./widget-chart";

export function WindupDemo() {
  const [antiWindup, setAntiWindup] = useState(true);
  const snapshot = useMemo(() => buildWindupTeachingSnapshot(antiWindup), [antiWindup]);

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Integral windup on saturation release</h3>
        </div>
        <button
          type="button"
          className={`button ${antiWindup ? "button-primary" : "button-secondary"}`}
          onClick={() => setAntiWindup((current) => !current)}
        >
          Anti-windup {antiWindup ? "On" : "Off"}
        </button>
      </div>

      <div className="lesson-widget-stats">
        <div className="lesson-widget-stat">
          <span>Overshoot</span>
          <strong>{snapshot.overshootPct.toFixed(1)}%</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Peak PV</span>
          <strong>{snapshot.peakPv.toFixed(1)}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Limit release</span>
          <strong>{snapshot.releaseTime.toFixed(0)}s</strong>
        </div>
      </div>

      <p className="lesson-widget-note">
        The output ceiling is held at 45% until {snapshot.releaseTime.toFixed(0)}s, then released. Without anti-windup,
        the stored integral demand makes the loop overshoot harder when that ceiling disappears.
      </p>

      <WidgetChart
        title="Saturation release behavior"
        subtitle="SP stays fixed. Only the controller's internal integral handling changes."
        series={snapshot.series}
      />
    </section>
  );
}
