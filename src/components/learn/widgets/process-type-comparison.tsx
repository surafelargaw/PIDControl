"use client";

import { useMemo } from "react";
import { buildProcessTypeComparisonSnapshot } from "./mini-sim";
import { WidgetChart } from "./widget-chart";

export function ProcessTypeComparison() {
  const snapshot = useMemo(() => buildProcessTypeComparisonSnapshot(), []);

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Same output step, different process behavior</h3>
        </div>
        <span className="pill info">Step at {snapshot.stepAt}s</span>
      </div>

      <div className="lesson-widget-stats">
        <div className="lesson-widget-stat">
          <span>Self-regulating settle</span>
          <strong>
            {snapshot.selfRegulating.metrics.settlingTime?.toFixed(1) ?? "Not settled"}
            {snapshot.selfRegulating.metrics.settlingTime ? "s" : ""}
          </strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Integrating offset</span>
          <strong>{snapshot.integrating.metrics.steadyStateOffset.toFixed(1)}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Output step</span>
          <strong>{snapshot.highOutput.toFixed(0)}%</strong>
        </div>
      </div>

      <WidgetChart
        title="Self-regulating vs integrating"
        subtitle="A self-regulating process bends toward a new balance. An integrating process keeps drifting while the imbalance remains."
        series={snapshot.series}
      />
    </section>
  );
}
