"use client";

import { useMemo, useState } from "react";
import type { ControllerAlgorithm, StabilityStatus } from "@/lib/sim/types";
import { buildPidResponseLibrary } from "./mini-sim";
import { WidgetChart } from "./widget-chart";

const statusClassMap: Record<StabilityStatus, string> = {
  stable: "success",
  marginal: "warning",
  unstable: "danger"
};

function formatSeconds(value: number | null) {
  return value === null ? "Not settled" : `${value.toFixed(1)}s`;
}

export function PidResponseChart() {
  const [activeAlgorithm, setActiveAlgorithm] = useState<ControllerAlgorithm>("PI");
  const responseLibrary = useMemo(() => buildPidResponseLibrary(), []);
  const activeResponse = responseLibrary[activeAlgorithm];

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>How P, PI, and PID change the same step response</h3>
        </div>
        <span className={`pill ${statusClassMap[activeResponse.result.metrics.stability.status]}`}>
          {activeResponse.result.metrics.stability.status}
        </span>
      </div>

      <div className="lesson-widget-segmented">
        {(["P", "PI", "PID"] as const).map((algorithm) => (
          <button
            key={algorithm}
            type="button"
            className={`button ${activeAlgorithm === algorithm ? "button-primary" : "button-secondary"}`}
            onClick={() => setActiveAlgorithm(algorithm)}
          >
            {algorithm}
          </button>
        ))}
      </div>

      <div className="lesson-widget-stats">
        <div className="lesson-widget-stat">
          <span>Settling</span>
          <strong>{formatSeconds(activeResponse.result.metrics.settlingTime)}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Overshoot</span>
          <strong>{activeResponse.result.metrics.overshootPct.toFixed(1)}%</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Offset</span>
          <strong>{activeResponse.result.metrics.steadyStateOffset.toFixed(1)}</strong>
        </div>
      </div>

      <WidgetChart
        title={`${activeAlgorithm} response`}
        subtitle="Same model, same setpoint step, same plant. Only the controller structure changes."
        series={activeResponse.series}
      />
    </section>
  );
}
