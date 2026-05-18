"use client";

import { useMemo, useState } from "react";
import { buildPidTermExplorerSnapshot } from "./mini-sim";
import { WidgetChart } from "./widget-chart";

export function PidTermExplorer() {
  const [kp, setKp] = useState(1.6);
  const [ti, setTi] = useState(20);
  const snapshot = useMemo(() => buildPidTermExplorerSnapshot(kp, ti), [kp, ti]);

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>PID term explorer</h3>
        </div>
        <span className="pill info">Td fixed at 4.0s</span>
      </div>

      <div className="lesson-widget-inline-grid">
        <label className="field">
          <span className="label">Kp</span>
          <input
            type="range"
            min="0.6"
            max="3.2"
            step="0.1"
            value={kp}
            onChange={(event) => setKp(Number(event.target.value))}
          />
          <span className="readout">{kp.toFixed(1)}</span>
        </label>

        <label className="field">
          <span className="label">Ti (s)</span>
          <input
            type="range"
            min="6"
            max="50"
            step="1"
            value={ti}
            onChange={(event) => setTi(Number(event.target.value))}
          />
          <span className="readout">{ti.toFixed(0)}s</span>
        </label>
      </div>

      <div className="lesson-widget-stats">
        <div className="lesson-widget-stat">
          <span>Latest P</span>
          <strong>{snapshot.latestTerms.p.toFixed(1)}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Latest I</span>
          <strong>{snapshot.latestTerms.i.toFixed(1)}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Latest D</span>
          <strong>{snapshot.latestTerms.d.toFixed(1)}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Total</span>
          <strong>{snapshot.latestTerms.total.toFixed(1)}</strong>
        </div>
      </div>

      <WidgetChart
        title="P, I, and D contributions"
        subtitle="Watch how stronger proportional action and faster integral action change the makeup of the response."
        series={snapshot.series}
      />
    </section>
  );
}
