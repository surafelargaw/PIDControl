"use client";

import { useMemo, useState } from "react";
import { buildDeadbandValveSnapshot } from "./mini-sim";
import { WidgetChart } from "./widget-chart";

export function DeadbandValveDemo() {
  const [deadband, setDeadband] = useState(1);
  const snapshot = useMemo(() => buildDeadbandValveSnapshot(deadband), [deadband]);

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Deadband eats small output movement</h3>
        </div>
        <span className="pill info">Valve deadband {deadband.toFixed(1)}%</span>
      </div>

      <label className="field">
        <span className="label">Deadband width</span>
        <input
          type="range"
          min="0"
          max="6"
          step="0.5"
          value={deadband}
          onChange={(event) => setDeadband(Number(event.target.value))}
        />
      </label>

      <div className="lesson-widget-stats">
        <div className="lesson-widget-stat">
          <span>CO travel</span>
          <strong>{snapshot.coTravel.toFixed(1)}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Valve travel</span>
          <strong>{snapshot.valveTravel.toFixed(1)}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Lost travel</span>
          <strong>{snapshot.lostTravel.toFixed(1)}</strong>
        </div>
      </div>

      <WidgetChart
        title="CO vs valve position"
        subtitle="As deadband widens, more controller motion is absorbed before the valve starts moving."
        series={snapshot.series}
      />
    </section>
  );
}
