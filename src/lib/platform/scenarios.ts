import type { ScenarioDefinition, ScoredAttempt } from "@/lib/sim/types";

export const scenarioRegistry: ScenarioDefinition[] = [
  {
    id: "level-tight-settle",
    title: "Level Control Without Spill Risk",
    difficulty: "Beginner",
    objective: "Tune the self-regulating tank level loop for less than 5% overshoot and settling within 45 seconds.",
    modelId: "selfRegulatingLevel",
    passCriteria: {
      overshootPct: 5,
      settlingTime: 45,
      stabilityStatus: "stable",
      steadyStateOffset: 2
    },
    hints: [
      "Start with PI, not full PID.",
      "If the loop is calm but drifting, shorten Ti a little before pushing Kp too far."
    ],
    debrief: [
      "A level loop can look calm while still carrying steady-state offset.",
      "A good tank result should be stable, not just slow."
    ]
  },
  {
    id: "pressure-noise-rejection",
    title: "Pressure Loop With Noise",
    difficulty: "Intermediate",
    objective: "Hold duct pressure while surviving noise and a pulse disturbance without retuning during the run.",
    modelId: "gasPressure",
    processOptions: {
      noiseLevel: 40,
      disturbanceProfile: "pulseLoad",
      disturbanceIntensity: 45
    },
    passCriteria: {
      overshootPct: 10,
      settlingTime: 35,
      stabilityStatus: "stable",
      saturationPct: 12
    },
    hints: [
      "PV filtering can help here, but too much filter time will slow real recovery.",
      "This scenario rewards disturbance rejection more than setpoint tracking."
    ],
    debrief: [
      "Fast loops punish noisy sensors quickly.",
      "A loop is not healthy if the PV looks calm but the actuator is chattering."
    ]
  },
  {
    id: "thermal-robustness",
    title: "Thermal Loop With Limited Overshoot",
    difficulty: "Intermediate",
    objective: "Tune the reactor temperature loop for a robust response with no prolonged output saturation.",
    modelId: "reactorTemperature",
    passCriteria: {
      overshootPct: 8,
      settlingTime: 80,
      stabilityStatus: "stable",
      saturationPct: 10
    },
    hints: [
      "Thermal loops need patience. Avoid chasing the first few seconds.",
      "Derivative is only helpful if the measurement is clean enough to support it."
    ],
    debrief: [
      "Operator-grade stability values robust settling over raw speed.",
      "Saturation usually points to authority or bias limits before it points to missing gain."
    ]
  },
  {
    id: "stability-rescue",
    title: "Recover A Marginal Loop",
    difficulty: "Advanced",
    objective: "Take an unstable fan static loop and bring it back to a stable verdict without flattening it completely.",
    modelId: "fanStaticPressure",
    controllerConfig: {
      kp: 2.8,
      ti: 5.5,
      td: 0.4
    },
    processOptions: {
      disturbanceProfile: "cyclicLoad",
      disturbanceIntensity: 30
    },
    passCriteria: {
      overshootPct: 10,
      settlingTime: 30,
      stabilityStatus: "stable",
      saturationPct: 8
    },
    hints: [
      "Start by removing the reason the loop is marginal, then reclaim speed.",
      "A constant-amplitude cycle is not a pass."
    ],
    debrief: [
      "Good rescue work means the oscillation is gone and the loop still feels responsive.",
      "The goal is not to hide the problem with an overly sluggish tuning."
    ]
  }
];

export function getScenario(scenarioId?: string | null) {
  if (!scenarioId) {
    return null;
  }
  return scenarioRegistry.find((scenario) => scenario.id === scenarioId) ?? null;
}

export function scoreScenarioAttempt(
  scenario: ScenarioDefinition,
  metrics: {
    overshootPct: number;
    settlingTime: number | null;
    steadyStateOffset: number;
    saturationPct: number;
    stabilityStatus: "stable" | "marginal" | "unstable";
  }
): ScoredAttempt {
  let score = 100;
  const checks: boolean[] = [];

  if (typeof scenario.passCriteria.overshootPct === "number") {
    checks.push(metrics.overshootPct <= scenario.passCriteria.overshootPct);
    score -= Math.max(0, metrics.overshootPct - scenario.passCriteria.overshootPct) * 2.2;
  }

  if (typeof scenario.passCriteria.settlingTime === "number") {
    checks.push(
      metrics.settlingTime !== null && metrics.settlingTime <= scenario.passCriteria.settlingTime
    );
    if (metrics.settlingTime !== null) {
      score -= Math.max(0, metrics.settlingTime - scenario.passCriteria.settlingTime) * 0.8;
    } else {
      score -= 30;
    }
  }

  if (typeof scenario.passCriteria.steadyStateOffset === "number") {
    checks.push(Math.abs(metrics.steadyStateOffset) <= scenario.passCriteria.steadyStateOffset);
    score -= Math.max(0, Math.abs(metrics.steadyStateOffset) - scenario.passCriteria.steadyStateOffset) * 4;
  }

  if (typeof scenario.passCriteria.saturationPct === "number") {
    checks.push(metrics.saturationPct <= scenario.passCriteria.saturationPct);
    score -= Math.max(0, metrics.saturationPct - scenario.passCriteria.saturationPct) * 2.5;
  }

  if (scenario.passCriteria.stabilityStatus) {
    checks.push(metrics.stabilityStatus === scenario.passCriteria.stabilityStatus);
    if (metrics.stabilityStatus === "marginal") {
      score -= 15;
    } else if (metrics.stabilityStatus === "unstable") {
      score -= 30;
    }
  }

  const passed = checks.every(Boolean);

  return {
    scenarioId: scenario.id,
    score: Math.max(0, Math.round(score)),
    passed,
    createdAt: new Date().toISOString(),
    stability: metrics.stabilityStatus,
    overshootPct: metrics.overshootPct,
    settlingTime: metrics.settlingTime,
    steadyStateOffset: metrics.steadyStateOffset
  };
}
