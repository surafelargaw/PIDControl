"use client";

import { useMemo, useState } from "react";

const WORKFLOW_STEPS = [
  {
    id: "capture",
    label: "Capture",
    title: "Capture a clean test window",
    summary:
      "Export timestamps, setpoint, PV, and controller output from a deliberate step or disturbance so the loop can be identified from actual behavior.",
    bestInput: "One clean event",
    outcome: "Model-ready dataset",
    caution: "Noise or hidden resets"
  },
  {
    id: "model",
    label: "Model",
    title: "Fit the simplest process model that explains the trend",
    summary:
      "Start with a first-order-plus-deadtime style fit. Move to second-order or a custom transfer function only when the simpler model misses the dominant lag or delay.",
    bestInput: "FOPDT first",
    outcome: "Lag and delay fit",
    caution: "Overfitting"
  },
  {
    id: "controller",
    label: "Match Form",
    title: "Match the real controller implementation",
    summary:
      "Before applying gains, verify controller form, integral definition, derivative source, filters, limits, and whether setpoint weighting or feedforward is active.",
    bestInput: "Vendor settings",
    outcome: "Apples-to-apples gains",
    caution: "Form mismatch"
  },
  {
    id: "validate",
    label: "Validate",
    title: "Simulate and pressure-test before commissioning",
    summary:
      "Preview setpoint changes, disturbance recovery, saturation, and mode changes. If the simulated loop only works in one perfect case, the field tune is not ready yet.",
    bestInput: "Several replay cases",
    outcome: "Safer first trial",
    caution: "One-case tuning"
  }
] as const;

export function DataDrivenTuningWorkflow() {
  const [activeStepId, setActiveStepId] = useState<(typeof WORKFLOW_STEPS)[number]["id"]>("capture");
  const activeStep = useMemo(
    () => WORKFLOW_STEPS.find((step) => step.id === activeStepId) ?? WORKFLOW_STEPS[0],
    [activeStepId]
  );

  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Data-driven tuning workflow</h3>
        </div>
        <span className="pill info">Software-assisted tuning</span>
      </div>

      <div className="lesson-widget-segmented">
        {WORKFLOW_STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            className={`button ${activeStep.id === step.id ? "button-primary" : "button-secondary"}`}
            onClick={() => setActiveStepId(step.id)}
          >
            {step.label}
          </button>
        ))}
      </div>

      <div className="lesson-widget-stats">
        <div className="lesson-widget-stat">
          <span>Best input</span>
          <strong>{activeStep.bestInput}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Output</span>
          <strong>{activeStep.outcome}</strong>
        </div>
        <div className="lesson-widget-stat">
          <span>Watch for</span>
          <strong>{activeStep.caution}</strong>
        </div>
      </div>

      <p className="lesson-widget-note">{activeStep.summary}</p>
      <p className="lesson-widget-note">
        {activeStep.title}. The aim is not only to calculate gains, but to build confidence that the gains still make
        sense once limits, vendor options, and real disturbances show up.
      </p>
    </section>
  );
}
