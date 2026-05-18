"use client";

import { useMemo, useState } from "react";
import { buildBiasSliderSnapshot } from "./mini-sim";
import { WidgetChart } from "./widget-chart";

export function BiasSliderDemo() {
  const [bias, setBias] = useState(37);
  const snapshot = useMemo(() => buildBiasSliderSnapshot(bias), [bias]);

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Bias is a baseline, not a floor</h3>
        </div>
        <span className="pill info">Bias {bias.toFixed(0)}%</span>
      </div>

      <label className="field">
        <span className="label">Bias</span>
        <input
          type="range"
          min="15"
          max="55"
          step="1"
          value={bias}
          onChange={(event) => setBias(Number(event.target.value))}
        />
      </label>

      <div className="lesson-widget-stats">
        <div className="lesson-widget-stat">
          <span>Average CO</span>
          <strong>{snapshot.averageCo.toFixed(1)}%</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Min CO</span>
          <strong>{snapshot.minCo.toFixed(1)}%</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Max CO</span>
          <strong>{snapshot.maxCo.toFixed(1)}%</strong>
        </div>
      </div>

      <p className="lesson-widget-note">
        The dashed line is the configured bias. The controller still trims above and below it as the load rises and
        falls, which is why bias should be read as a center point for modulation rather than a hard minimum command.
      </p>

      <WidgetChart
        title="Output trimming around bias"
        subtitle="The setpoint steps up and later steps down so you can see the output move on both sides of the bias line."
        series={snapshot.series}
      />
    </section>
  );
}
