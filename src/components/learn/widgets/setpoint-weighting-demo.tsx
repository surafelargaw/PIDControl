"use client";

import { useMemo, useState } from "react";
import { buildSetpointWeightingSnapshot } from "./mini-sim";
import { WidgetChart } from "./widget-chart";

const BETA_PRESETS = [
  { label: "Beta 1.00", value: 1.0 },
  { label: "Beta 0.60", value: 0.6 },
  { label: "Beta 0.35", value: 0.35 }
] as const;

export function SetpointWeightingDemo() {
  const [beta, setBeta] = useState<number>(1.0);
  const snapshot = useMemo(() => buildSetpointWeightingSnapshot(beta), [beta]);

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Setpoint weighting softens the setpoint kick</h3>
        </div>
        <span className="pill info">2-DOF anti-overshoot idea</span>
      </div>

      <div className="lesson-widget-segmented">
        {BETA_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`button ${beta === preset.value ? "button-primary" : "button-secondary"}`}
            onClick={() => setBeta(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="lesson-widget-stats">
        <div className="lesson-widget-stat">
          <span>Overshoot</span>
          <strong>{snapshot.overshootPct.toFixed(1)}%</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Settling</span>
          <strong>{snapshot.settlingTime === null ? "Not settled" : `${snapshot.settlingTime.toFixed(1)}s`}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Peak CO</span>
          <strong>{snapshot.peakCo.toFixed(1)}%</strong>
        </div>
      </div>

      <p className="lesson-widget-note">
        Lower setpoint weighting keeps the integral path active but reduces how hard proportional action reacts to a
        setpoint step. That usually trims overshoot without having to blunt the whole loop with a heavy output clamp.
      </p>

      <WidgetChart
        title="Setpoint step with different weighting"
        subtitle={`The setpoint steps at ${snapshot.stepTime.toFixed(0)}s. PV and CO both calm down as beta is reduced.`}
        series={snapshot.series}
      />
    </section>
  );
}
