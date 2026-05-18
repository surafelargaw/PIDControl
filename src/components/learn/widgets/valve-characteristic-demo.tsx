"use client";

import { useMemo } from "react";
import { buildValveCharacteristicSnapshot, valveCharacteristicLabels, valveCharacteristicOrder } from "./mini-sim";
import { WidgetChart } from "./widget-chart";

export function ValveCharacteristicDemo() {
  const snapshot = useMemo(() => buildValveCharacteristicSnapshot(), []);

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Valve Cv changes process gain</h3>
        </div>
        <span className="pill info">Same PID, different valve trim</span>
      </div>

      <div className="lesson-widget-stats">
        {valveCharacteristicOrder.map((characteristic) => {
          const metrics = snapshot.results[characteristic].metrics;
          return (
            <div className="lesson-widget-stat" key={characteristic}>
              <span>{valveCharacteristicLabels[characteristic]}</span>
              <strong>{metrics.overshootPct.toFixed(1)}% OS</strong>
            </div>
          );
        })}
      </div>

      <p className="lesson-widget-note">
        The curve chart maps valve stroke to effective flow. The response chart keeps the same process, setpoint step,
        and PID settings, then changes only the final-element characteristic.
      </p>

      <WidgetChart
        title="Valve position to effective flow"
        subtitle="Quick opening moves flow early; equal percentage saves most authority for the upper stroke."
        series={snapshot.curveSeries}
      />

      <WidgetChart
        title="Closed-loop PV response"
        subtitle="Changing valve trim changes effective process gain, so identical PID numbers do not feel identical."
        series={snapshot.responseSeries}
      />
    </section>
  );
}
