"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  advanceSimulationStep,
  buildSignalState,
  createRuntime,
  createSimulationOptions,
  disturbanceProfiles
} from "@/lib/sim/engine";
import { calculateRunMetrics } from "@/lib/sim/metrics";
import { getProcessModel, processModelRegistry } from "@/lib/sim/models";
import { buildCleanTuningProcessOptions, generateFineTuneAdvice, runTuningStudy, type TuningMethod } from "@/lib/sim/tuning";
import type { ControllerAlgorithm, SavedRunRecord, ScenarioDefinition } from "@/lib/sim/types";
import { MetricCardGrid } from "@/components/sim/metric-card-grid";
import { StabilityBadge } from "@/components/sim/stability-badge";
import { TrendChart } from "@/components/sim/trend-chart";
import { FieldHelpTip, FieldLabel, type FieldHelpContent } from "@/components/platform/field-help";
import { downloadRunReportPdf, downloadSvgAsPng, recordToPdfPayload } from "@/lib/platform/reporting";
import { saveRun, saveScenarioAttempt } from "@/lib/platform/local-store";
import { scoreScenarioAttempt } from "@/lib/platform/scenarios";
import { clamp, slugify } from "@/lib/sim/utils";

function getSampleAtTime(history: ReturnType<typeof createRuntime>["history"], time: number | null) {
  if (time === null || !history.length) {
    return null;
  }

  return history.reduce((closest, current) =>
    Math.abs(current.time - time) < Math.abs(closest.time - time) ? current : closest
  );
}

function buildScenarioSeed(scenario: ScenarioDefinition | null) {
  const modelId = scenario?.modelId ?? processModelRegistry[0].id;
  const options = createSimulationOptions(modelId);
  if (scenario) {
    options.controllerConfig = { ...options.controllerConfig, ...scenario.controllerConfig };
    options.processOptions = { ...options.processOptions, ...scenario.processOptions };
  }
  return { modelId, options };
}

const helpLinks = {
  controller: "/learn?lesson=controller-settings",
  operatingModes: "/learn?lesson=operating-modes",
  process: "/learn?lesson=process-signals-trends",
  tuningMethods: "/learn?lesson=tuning-methods",
  antiWindup: "/learn?lesson=anti-windup"
} as const;

const processSignalPathHref = `${helpLinks.process}#pv-and-secondary-pv-in-the-pid-path`;

const trendSignalHelp: Record<"pv" | "secondaryPv", FieldHelpContent> = {
  pv: {
    title: "PV In The PID Path",
    body:
      "PV is the controlled measurement used by the PID for error calculation. The controller compares SP and PV, then calculates CO/MV for the final element.",
    href: processSignalPathHref,
    linkLabel: "Open PV guide"
  },
  secondaryPv: {
    title: "Secondary PV In The PID Path",
    body:
      "Secondary PV is a diagnostic/intermediate process signal. In the Lab it shows internal or coupled process movement before or alongside the final PV; the primary PV is still the main stability signal.",
    href: processSignalPathHref,
    linkLabel: "Open signal guide"
  }
};

const controllerFieldHelp: Record<string, FieldHelpContent> = {
  setpoint: {
    title: "Setpoint",
    body: "Target value the controller tries to hold. A setpoint step is useful for testing response, overshoot, and settling.",
    href: helpLinks.controller
  },
  mode: {
    title: "Mode",
    body: "Auto lets PID calculate output. Manual bypasses automatic correction and holds the operator output.",
    href: helpLinks.operatingModes
  },
  operatingMode: {
    title: "Operating Mode",
    body: "Changes the control structure: single-loop, feedforward assist, cascade behavior, or interacting loop behavior.",
    href: helpLinks.operatingModes
  },
  algorithm: {
    title: "Algorithm",
    body: "Chooses P, PI, or PID terms. PI is common for HVAC; PID adds derivative for rate-of-change damping when the PV is clean.",
    href: helpLinks.controller
  },
  kp: {
    title: "Kp",
    body: "Proportional gain. Higher Kp reacts harder to current error, but too much creates hunting or overshoot.",
    href: helpLinks.controller
  },
  ti: {
    title: "Ti",
    body: "Integral time. Lower Ti means stronger reset action and faster offset removal, but more overshoot risk.",
    href: helpLinks.controller
  },
  td: {
    title: "Td",
    body: "Derivative time. Adds response to rate of change; useful only when measurement noise is controlled.",
    href: helpLinks.controller
  },
  manualOutput: {
    title: "Manual Output",
    body: "Fixed output sent in Manual mode through the same output limits and valve behavior as Auto.",
    href: helpLinks.operatingModes
  },
  outputDeadband: {
    title: "PID Output Deadband",
    body: "Holds controller output changes smaller than this percentage before the signal reaches the actuator model.",
    href: helpLinks.controller
  },
  spFilterTime: {
    title: "SP Filter Time",
    body: "First-order filter on setpoint. Larger values soften setpoint changes and reduce output kick.",
    href: helpLinks.controller
  },
  pvFilterTime: {
    title: "PV Filter Time",
    body: "First-order filter on measured PV. It can calm noisy signals but adds lag to controller decisions.",
    href: helpLinks.process
  }
};

const processFieldHelp: Record<string, FieldHelpContent> = {
  disturbance: {
    title: "Disturbance",
    body: "External load shape applied to the process. Use it to test recovery after real-world load changes.",
    href: helpLinks.process
  },
  disturbanceIntensity: {
    title: "Disturbance Intensity",
    body: "Scales how strongly the disturbance pushes PV away from setpoint.",
    href: helpLinks.process
  },
  noise: {
    title: "Noise",
    body: "Random PV jitter. Noise can make derivative action and aggressive gain chatter the output.",
    href: helpLinks.process
  },
  measurementLag: {
    title: "Measurement Lag",
    body: "Delay in the measured PV signal. Lag hides real movement and can make aggressive tuning overshoot.",
    href: helpLinks.process
  },
  deadband: {
    title: "Actuator Deadband",
    body: "Output changes smaller than this band are ignored by the modeled actuator, reducing wear but creating lost motion.",
    href: helpLinks.antiWindup
  },
  stiction: {
    title: "Stiction",
    body: "Actuator friction that resists small moves. It can create stair-step response and cycling around setpoint.",
    href: helpLinks.process
  },
  flowCharacteristic: {
    title: "Flow Characteristic",
    body:
      "Maps valve position to effective flow. Linear gives even response, equal percentage is gentle near closed and stronger near open, and quick opening gives strong early flow.",
    href: helpLinks.process
  }
};

const tuningFieldHelp: Record<string, FieldHelpContent> = {
  method: {
    title: "Method",
    body: "Selects the study type used to estimate tuning: step response, ultimate gain, relay autotune, IMC/Lambda, or bump test.",
    href: helpLinks.tuningMethods
  },
  targetAlgorithm: {
    title: "Target Algorithm",
    body: "Chooses whether the study returns P, PI, or PID settings.",
    href: helpLinks.tuningMethods
  },
  step: {
    title: "Step",
    body: "Manual output bump used for open-loop Cohen-Coon and bump-test studies.",
    href: helpLinks.tuningMethods
  },
  relayAmplitude: {
    title: "Relay Amplitude",
    body: "Half-swing output used by relay autotune to estimate ultimate gain and oscillation period.",
    href: helpLinks.tuningMethods
  },
  lambdaFactor: {
    title: "Lambda Factor",
    body: "IMC/Lambda response-speed target. Higher values are calmer; lower values are faster and riskier.",
    href: helpLinks.tuningMethods
  }
};

const stabilityVerdictHelp: FieldHelpContent = {
  title: "PID Stability Verdict",
  body:
    "Stable means the PV settles near SP without excessive overshoot, cycling, steady-state error, or saturation. Marginal means one or more warning conditions remain, such as sustained/decaying oscillation, high overshoot, offset, or output saturation. Unstable means the response is diverging, not settling, or spending too long at an output limit.",
  href: "/learn?lesson=stability-checker-guide",
  linkLabel: "Open stability guide"
};

function exportCsv(history: ReturnType<typeof createRuntime>["history"], modelId: string, modelName: string) {
  const header = ["time_s", "model_id", "model_name", "pv", "secondary_pv", "sp", "sp_filtered", "co", "valve_position", "p_term", "i_term", "d_term", "disturbance", "saturation_state"];
  const rows = history.map((sample) => [
    sample.time,
    modelId,
    modelName,
    sample.pv,
    sample.secondaryPv,
    sample.sp,
    sample.spFiltered,
    sample.co,
    sample.valvePosition ?? "",
    sample.pTerm,
    sample.iTerm,
    sample.dTerm,
    sample.disturbance,
    sample.saturationState
  ].join(","));

  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(modelName)}-run.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function LabWorkspace({ scenario }: { scenario: ScenarioDefinition | null }) {
  const seeded = useMemo(() => buildScenarioSeed(scenario), [scenario]);
  const [modelId, setModelId] = useState(seeded.modelId);
  const [simulationOptions, setSimulationOptions] = useState(seeded.options);
  const [history, setHistory] = useState(() => createRuntime(getProcessModel(seeded.modelId), seeded.options).history);
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [timespan, setTimespan] = useState(300);
  const [cursorMode, setCursorMode] = useState<"one" | "two">("two");
  const [activeCursor, setActiveCursor] = useState<"a" | "b">("a");
  const [cursors, setCursors] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });
  const [tuningMethod, setTuningMethod] = useState<TuningMethod>("cohenCoon");
  const [targetAlgorithm, setTargetAlgorithm] = useState<ControllerAlgorithm>("PID");
  const [tuningStep, setTuningStep] = useState(8);
  const [relayAmplitude, setRelayAmplitude] = useState(10);
  const [lambdaFactor, setLambdaFactor] = useState(2.2);
  const [tuningResult, setTuningResult] = useState<ReturnType<typeof runTuningStudy> | null>(null);
  const runtimeRef = useRef(createRuntime(getProcessModel(seeded.modelId), seeded.options));
  const responseSvgRef = useRef<SVGSVGElement | null>(null);
  const tickRef = useRef<() => void>(() => {});
  const currentModel = useMemo(() => getProcessModel(modelId), [modelId]);

  useEffect(() => {
    const next = buildScenarioSeed(scenario);
    setModelId(next.modelId);
    setSimulationOptions(next.options);
    const runtime = createRuntime(getProcessModel(next.modelId), next.options);
    runtimeRef.current = runtime;
    setHistory(runtime.history);
    setCursors({ a: null, b: null });
    setTuningResult(null);
  }, [scenario]);

  const visibleHistory = useMemo(() => {
    if (timespan === 0 || !history.length) {
      return history;
    }
    const latest = history[history.length - 1]?.time ?? 0;
    return history.filter((sample) => sample.time >= latest - timespan);
  }, [history, timespan]);

  const runMetrics = useMemo(() => calculateRunMetrics(history, currentModel), [history, currentModel]);
  const metrics = useMemo(() => calculateRunMetrics(visibleHistory, currentModel), [visibleHistory, currentModel]);
  const fineTuneAdvice = useMemo(
    () => generateFineTuneAdvice(currentModel, simulationOptions.controllerConfig, visibleHistory, simulationOptions.processOptions),
    [currentModel, visibleHistory, simulationOptions.controllerConfig, simulationOptions.processOptions]
  );
  const cursorA = getSampleAtTime(visibleHistory, cursors.a);
  const cursorB = getSampleAtTime(visibleHistory, cursors.b);
  const outputMin = simulationOptions.controllerConfig.outputLimits.min;
  const outputMax = simulationOptions.controllerConfig.outputLimits.max;
  const manualOutput = clamp(simulationOptions.controllerConfig.manualOutput, outputMin, outputMax);
  const latestCo = visibleHistory[visibleHistory.length - 1]?.co ?? manualOutput;
  const deadbandWidth = Math.max(0, simulationOptions.processOptions.valveDeadband);
  const deadbandCenter = simulationOptions.controllerConfig.mode === "manual" ? manualOutput : latestCo;
  const deadbandBand =
    deadbandWidth > 0
      ? {
          label: `Actuator DB +/-${deadbandWidth.toFixed(1)}%`,
          from: clamp(deadbandCenter - deadbandWidth, outputMin, outputMax),
          to: clamp(deadbandCenter + deadbandWidth, outputMin, outputMax),
          color: "#f59e0b",
          axis: "right" as const
        }
      : null;
  const outputAxis = { min: outputMin, max: outputMax, label: "Output %" };

  tickRef.current = () => {
    if (!isRunning) {
      return;
    }
    const runtime = runtimeRef.current;
    for (let index = 0; index < speed; index += 1) {
      advanceSimulationStep(
        runtime,
        runtime.baseDt,
        currentModel,
        simulationOptions,
        buildSignalState(simulationOptions.analogInputs ?? [])
      );
    }
    startTransition(() => setHistory([...runtime.history]));
  };

  useEffect(() => {
    const timerId = window.setInterval(() => tickRef.current(), 100);
    return () => window.clearInterval(timerId);
  }, []);

  const resetRuntime = (nextModelId = modelId, nextOptions = simulationOptions) => {
    const runtime = createRuntime(getProcessModel(nextModelId), nextOptions);
    runtimeRef.current = runtime;
    setHistory(runtime.history);
    setCursors({ a: null, b: null });
    setActiveCursor("a");
  };

  const applyModel = (nextModelId: string) => {
    const nextOptions = createSimulationOptions(nextModelId);
    setModelId(nextModelId);
    setSimulationOptions(nextOptions);
    resetRuntime(nextModelId, nextOptions);
    setTuningResult(null);
  };

  const updateController = (patch: Partial<typeof simulationOptions.controllerConfig>) =>
    setSimulationOptions((current) => ({ ...current, controllerConfig: { ...current.controllerConfig, ...patch } }));
  const updateProcess = (patch: Partial<typeof simulationOptions.processOptions>) =>
    setSimulationOptions((current) => ({ ...current, processOptions: { ...current.processOptions, ...patch } }));

  const placeCursor = (time: number) => {
    setCursors((current) => {
      const next = { ...current, [activeCursor]: time };
      if (cursorMode === "one") {
        next.b = null;
      }
      return next;
    });
    if (cursorMode === "two") {
      setActiveCursor((current) => (current === "a" ? "b" : "a"));
    }
  };

  const responseSeries = [
    {
      label: "PV",
      color: "#5eead4",
      help: trendSignalHelp.pv,
      data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.pv }))
    },
    { label: "SP", color: "#f8fafc", data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.sp })), dashed: true },
    { label: "Filtered SP", color: "#fbbf24", data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.spFiltered })), dashed: true },
    ...(simulationOptions.controllerConfig.mode === "manual"
      ? [
          {
            label: "Manual Output",
            color: "#fb7185",
            data: visibleHistory.map((sample) => ({ x: sample.time, y: manualOutput })),
            dashed: true,
            axis: "right" as const
          }
        ]
      : [])
  ];

  const actuatorSeries = [
    { label: "CO", color: "#fb7185", data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.co })), axis: "right" as const },
    { label: "Valve", color: "#38bdf8", data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.valvePosition ?? sample.co })), dashed: true, axis: "right" as const },
    {
      label: "Secondary PV",
      color: "#c084fc",
      help: trendSignalHelp.secondaryPv,
      data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.secondaryPv }))
    }
  ];

  const termSeries = [
    { label: "P", color: "#f97316", data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.pTerm })) },
    { label: "I", color: "#22c55e", data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.iTerm })) },
    { label: "D", color: "#60a5fa", data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.dTerm })) },
    { label: "Total", color: "#f8fafc", data: visibleHistory.map((sample) => ({ x: sample.time, y: sample.totalTerm })), dashed: true }
  ];
  const chartCursorProps = {
    cursors: { a: cursors.a, b: cursors.b, enabledTwo: cursorMode === "two" },
    onPlaceCursor: placeCursor,
    activeCursor
  };

  const runStudy = () =>
    setTuningResult(
      runTuningStudy({
        model: currentModel,
        method: tuningMethod,
        targetAlgorithm,
        stepSize: tuningStep,
        relayAmplitude,
        lambdaFactor,
        currentController: simulationOptions.controllerConfig
      })
    );

  const applySuggestedTuning = () => {
    if (!tuningResult?.recommended) {
      return;
    }
    updateController({
      algorithm: tuningResult.recommended.algorithm,
      form: "standard",
      kp: tuningResult.recommended.kp,
      ti: tuningResult.recommended.ti ?? simulationOptions.controllerConfig.ti,
      td: tuningResult.recommended.td ?? 0
    });
  };

  const saveCurrentRun = () => {
    const record: SavedRunRecord = {
      id: `${slugify(currentModel.name)}-${Date.now()}`,
      title: `${scenario?.title ?? currentModel.name} ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      modelId: currentModel.id,
      scenarioId: scenario?.id,
      metrics: runMetrics,
      controllerConfig: { ...simulationOptions.controllerConfig, outputLimits: { ...simulationOptions.controllerConfig.outputLimits } },
      processOptions: { ...simulationOptions.processOptions }
    };
    saveRun(record);
  };

  const scoreScenario = () => {
    if (!scenario) {
      return;
    }
    saveScenarioAttempt(
      scoreScenarioAttempt(scenario, {
        overshootPct: runMetrics.overshootPct,
        settlingTime: runMetrics.settlingTime,
        steadyStateOffset: runMetrics.steadyStateOffset,
        saturationPct: runMetrics.stability.saturation_pct_of_run,
        stabilityStatus: runMetrics.stability.status
      })
    );
  };

  return (
    <main className="page-stack">
      <section className="page-card">
        <div className="chip-row">
          <div>
            <p className="eyebrow">Lab</p>
            <h2>Interactive PID Workspace</h2>
            <p>{currentModel.description}</p>
          </div>
          <div className="chip-row">
            <StabilityStatusWithHelp status={metrics.stability.status} />
            <span className="pill info">{currentModel.category}</span>
            <span className="pill info">{currentModel.units}</span>
          </div>
        </div>
        {scenario ? (
          <div className="note-card">
            <p className="eyebrow">Active Scenario</p>
            <h3>{scenario.title}</h3>
            <p>{scenario.objective}</p>
          </div>
        ) : null}
      </section>

      <section className="panel-grid">
        <div className="page-stack">
          <article className="panel">
            <div className="run-controls-head">
              <div>
                <p className="eyebrow">Run Controls</p>
                <h2>Session Setup</h2>
              </div>
              <div className="run-controls-export-icons" aria-label="Export actions">
                <button
                  className="button button-secondary run-controls-icon-button"
                  aria-label="Export CSV"
                  title="Export CSV"
                  onClick={() => exportCsv(history, currentModel.id, currentModel.name)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v10" />
                    <path d="m8.5 9.5 3.5 3.5 3.5-3.5" />
                    <path d="M4.5 17.5h15" />
                  </svg>
                </button>
                <button
                  className="button button-secondary run-controls-icon-button"
                  aria-label="Export PNG"
                  title="Export PNG"
                  onClick={async () => {
                    if (responseSvgRef.current) {
                      await downloadSvgAsPng(responseSvgRef.current, `${slugify(currentModel.name)}-response.png`);
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="5" width="16" height="13" rx="2" ry="2" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path d="m7 16 3.2-3.2 2.2 2.2 2.8-2.8L18 15" />
                  </svg>
                </button>
                <button
                  className="button button-secondary run-controls-icon-button"
                  aria-label="Export PDF"
                  title="Export PDF"
                  onClick={() =>
                    downloadRunReportPdf({
                      ...recordToPdfPayload(
                        {
                          id: "preview",
                          title: scenario?.title ?? currentModel.name,
                          createdAt: new Date().toISOString(),
                          modelId: currentModel.id,
                          metrics: runMetrics,
                          controllerConfig: simulationOptions.controllerConfig,
                          processOptions: simulationOptions.processOptions
                        },
                        currentModel.name
                      ),
                      notes: scenario?.debrief
                    })
                  }
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 3.5h6l3 3v14H8z" />
                    <path d="M14 3.5v3h3" />
                    <path d="M10 12h5" />
                    <path d="M10 15h5" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="field-grid">
              <div className="field">
                <span className="label">Model</span>
                <select value={modelId} onChange={(event) => applyModel(event.target.value)}>
                  {processModelRegistry.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="label">Speed</span>
                <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                  {[1, 2, 5, 10, 30].map((value) => (
                    <option key={value} value={value}>
                      {value === 1 ? "Real time" : `${value}x`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="label">Window</span>
                <select value={timespan} onChange={(event) => setTimespan(Number(event.target.value))}>
                  <option value={30}>30 s</option>
                  <option value={60}>1 min</option>
                  <option value={120}>2 min</option>
                  <option value={300}>5 min</option>
                  <option value={0}>Full</option>
                </select>
              </div>
              <div className="field">
                <span className="label">Cursor Mode</span>
                <select
                  value={cursorMode}
                  onChange={(event) => {
                    const next = event.target.value as "one" | "two";
                    setCursorMode(next);
                    if (next === "one") {
                      setCursors((current) => ({ ...current, b: null }));
                    }
                  }}
                >
                  <option value="one">One</option>
                  <option value="two">Two</option>
                </select>
              </div>
            </div>
            <div className="button-row" style={{ marginTop: "1rem" }}>
              <button className="button button-primary" onClick={() => setIsRunning((current) => !current)}>
                {isRunning ? "Pause" : "Resume"}
              </button>
              <button className="button button-secondary" onClick={() => resetRuntime()}>
                Reset Runtime
              </button>
            </div>
          </article>

          <article className="panel">
            <p className="eyebrow">Controller</p>
            <h2>Loop Settings</h2>
            <div className="field-grid">
              <div className="field">
                <FieldLabel help={controllerFieldHelp.setpoint}>Setpoint</FieldLabel>
                <input
                  type="number"
                  value={simulationOptions.setpoint}
                  onChange={(event) =>
                    setSimulationOptions((current) => ({ ...current, setpoint: Number(event.target.value) }))
                  }
                />
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.mode}>Mode</FieldLabel>
                <select
                  value={simulationOptions.controllerConfig.mode}
                  onChange={(event) => updateController({ mode: event.target.value as "auto" | "manual" })}
                >
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.operatingMode}>Operating Mode</FieldLabel>
                <select
                  value={simulationOptions.controllerConfig.operatingMode}
                  onChange={(event) =>
                    updateController({
                      operatingMode: event.target.value as typeof simulationOptions.controllerConfig.operatingMode
                    })
                  }
                >
                  <option value="single">Single</option>
                  <option value="feedforward">Feedforward</option>
                  <option value="cascade">Cascade</option>
                  <option value="interacting">Interacting</option>
                </select>
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.algorithm}>Algorithm</FieldLabel>
                <select
                  value={simulationOptions.controllerConfig.algorithm}
                  onChange={(event) => updateController({ algorithm: event.target.value as ControllerAlgorithm })}
                >
                  <option value="P">P</option>
                  <option value="PI">PI</option>
                  <option value="PID">PID</option>
                </select>
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.kp}>Kp</FieldLabel>
                <input type="number" step="0.05" value={simulationOptions.controllerConfig.kp} onChange={(event) => updateController({ kp: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.ti}>Ti</FieldLabel>
                <input type="number" step="0.1" value={simulationOptions.controllerConfig.ti} onChange={(event) => updateController({ ti: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.td}>Td</FieldLabel>
                <input type="number" step="0.1" value={simulationOptions.controllerConfig.td} onChange={(event) => updateController({ td: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.manualOutput}>Manual Output</FieldLabel>
                <input type="number" value={simulationOptions.controllerConfig.manualOutput} onChange={(event) => updateController({ manualOutput: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.outputDeadband}>PID Output Deadband</FieldLabel>
                <input type="number" step="0.1" value={simulationOptions.controllerConfig.outputDeadband ?? 0} onChange={(event) => updateController({ outputDeadband: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.spFilterTime}>SP Filter Time</FieldLabel>
                <input type="number" step="0.1" value={simulationOptions.controllerConfig.spFilterTime} onChange={(event) => updateController({ spFilterTime: Number(event.target.value), spFilterEnabled: Number(event.target.value) > 0 })} />
              </div>
              <div className="field">
                <FieldLabel help={controllerFieldHelp.pvFilterTime}>PV Filter Time</FieldLabel>
                <input type="number" step="0.1" value={simulationOptions.controllerConfig.pvFilterTime} onChange={(event) => updateController({ pvFilterTime: Number(event.target.value), pvFilterEnabled: Number(event.target.value) > 0 })} />
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="eyebrow">Process</p>
            <h2>Noise And Valve Realism</h2>
            <div className="field-grid">
              <div className="field">
                <FieldLabel help={processFieldHelp.disturbance}>Disturbance</FieldLabel>
                <select value={simulationOptions.processOptions.disturbanceProfile} onChange={(event) => updateProcess({ disturbanceProfile: event.target.value as typeof simulationOptions.processOptions.disturbanceProfile })}>
                  {disturbanceProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <FieldLabel help={processFieldHelp.disturbanceIntensity}>Disturbance Intensity</FieldLabel>
                <input type="number" value={simulationOptions.processOptions.disturbanceIntensity} onChange={(event) => updateProcess({ disturbanceIntensity: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={processFieldHelp.noise}>Noise</FieldLabel>
                <input type="number" value={simulationOptions.processOptions.noiseLevel} onChange={(event) => updateProcess({ noiseLevel: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={processFieldHelp.measurementLag}>Measurement Lag</FieldLabel>
                <input type="number" value={simulationOptions.processOptions.measurementLag} onChange={(event) => updateProcess({ measurementLag: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={processFieldHelp.deadband}>Actuator Deadband</FieldLabel>
                <input type="number" value={simulationOptions.processOptions.valveDeadband} onChange={(event) => updateProcess({ valveDeadband: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={processFieldHelp.stiction}>Stiction</FieldLabel>
                <input type="number" value={simulationOptions.processOptions.valveStiction} onChange={(event) => updateProcess({ valveStiction: Number(event.target.value) })} />
              </div>
              <div className="field">
                <FieldLabel help={processFieldHelp.flowCharacteristic}>Flow Characteristic</FieldLabel>
                <select
                  value={simulationOptions.processOptions.flowCharacteristic}
                  onChange={(event) =>
                    updateProcess({
                      flowCharacteristic: event.target.value as typeof simulationOptions.processOptions.flowCharacteristic
                    })
                  }
                >
                  <option value="linear">Linear</option>
                  <option value="equalPercentage">Equal Percentage</option>
                  <option value="quickOpening">Quick Opening</option>
                </select>
              </div>
            </div>
          </article>

        </div>

        <div className="page-stack">
          <TrendChart
            title="PV / SP / Filtered SP"
            subtitle={`Next cursor: ${activeCursor.toUpperCase()}`}
            series={responseSeries}
            rightAxis={simulationOptions.controllerConfig.mode === "manual" || deadbandBand ? outputAxis : undefined}
            bands={deadbandBand ? [deadbandBand] : []}
            {...chartCursorProps}
            svgRef={responseSvgRef}
          />
          <TrendChart
            title="CO / Valve / Secondary PV"
            series={actuatorSeries}
            rightAxis={outputAxis}
            bands={deadbandBand ? [deadbandBand] : []}
            {...chartCursorProps}
          />
          <TrendChart title="P / I / D Contributions" series={termSeries} {...chartCursorProps} />

          <article className="panel">
            <p className="eyebrow">Fine-Tune Assistant</p>
            <h2>Post-Run Coaching</h2>
            <div className="advice-list">
              {fineTuneAdvice.map((item) => (
                <div key={item.title} className="advice-item">
                  <strong>{item.title}</strong>
                  <p className="muted" style={{ marginTop: "0.35rem" }}>{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="button-row" style={{ marginTop: "1rem" }}>
              <button className="button button-secondary" onClick={saveCurrentRun}>Save Run</button>
              {scenario ? <button className="button button-secondary" onClick={scoreScenario}>Score Scenario</button> : null}
              <Link href="/saved-runs" className="button button-secondary">Saved Runs</Link>
            </div>
          </article>
        </div>
      </section>

      <section className="page-card">
        <div className="chip-row">
          <div>
            <p className="eyebrow">Stability</p>
            <h2>Automatic Stability Checker</h2>
            <p>This run is judged against settling, overshoot, oscillation, steady-state error, and saturation behavior.</p>
          </div>
          <StabilityStatusWithHelp status={metrics.stability.status} />
        </div>
        <MetricCardGrid metrics={metrics} />
        <div className="two-up" style={{ marginTop: "1rem" }}>
          <article className="panel">
            <p className="eyebrow">Advisory</p>
            <h3>Checker Notes</h3>
            <div className="advice-list">
              {metrics.stability.advisory_messages.map((message) => (
                <div key={message} className="advice-item">{message}</div>
              ))}
            </div>
          </article>
          <article className="panel">
            <p className="eyebrow">Cursors</p>
            <h3>Manual Inspection</h3>
            <div className="annotation-list">
              <div className="annotation"><h3>Cursor A</h3><p>{cursorA ? `${cursorA.time.toFixed(1)}s, PV ${cursorA.pv.toFixed(currentModel.precision)}, CO ${cursorA.co.toFixed(1)}%` : "Not placed"}</p></div>
              <div className="annotation"><h3>Cursor B</h3><p>{cursorMode === "one" ? "Disabled" : cursorB ? `${cursorB.time.toFixed(1)}s, PV ${cursorB.pv.toFixed(currentModel.precision)}, CO ${cursorB.co.toFixed(1)}%` : "Not placed"}</p></div>
              {cursorA && cursorB ? <div className="annotation"><h3>Delta</h3><p>{Math.abs(cursorB.time - cursorA.time).toFixed(1)}s, PV {Math.abs(cursorB.pv - cursorA.pv).toFixed(currentModel.precision)}, CO {Math.abs(cursorB.co - cursorA.co).toFixed(1)}%</p></div> : null}
            </div>
          </article>
        </div>
      </section>

      <section className="two-up">
        <article className="panel">
          <p className="eyebrow">Method-Based Tuning</p>
          <h2>Tuning Studies</h2>
          <div className="field-grid">
            <div className="field">
              <FieldLabel help={tuningFieldHelp.method}>Method</FieldLabel>
              <select value={tuningMethod} onChange={(event) => setTuningMethod(event.target.value as TuningMethod)}>
                <option value="cohenCoon">Cohen-Coon</option>
                <option value="zieglerNichols">Ziegler-Nichols</option>
                <option value="tyreusLuyben">Tyreus-Luyben</option>
                <option value="relayAutotune">Relay Autotune</option>
                <option value="imcLambda">IMC / Lambda</option>
                <option value="bumpTest">Bump Test</option>
              </select>
            </div>
            <div className="field">
              <FieldLabel help={tuningFieldHelp.targetAlgorithm}>Target Algorithm</FieldLabel>
              <select value={targetAlgorithm} onChange={(event) => setTargetAlgorithm(event.target.value as ControllerAlgorithm)}>
                <option value="P">P</option>
                <option value="PI">PI</option>
                <option value="PID">PID</option>
              </select>
            </div>
            <div className="field"><FieldLabel help={tuningFieldHelp.step}>Step</FieldLabel><input type="number" value={tuningStep} onChange={(event) => setTuningStep(Number(event.target.value))} /></div>
            <div className="field"><FieldLabel help={tuningFieldHelp.relayAmplitude}>Relay Amplitude</FieldLabel><input type="number" value={relayAmplitude} onChange={(event) => setRelayAmplitude(Number(event.target.value))} /></div>
            <div className="field"><FieldLabel help={tuningFieldHelp.lambdaFactor}>Lambda Factor</FieldLabel><input type="number" step="0.1" value={lambdaFactor} onChange={(event) => setLambdaFactor(Number(event.target.value))} /></div>
          </div>
          <div className="annotation-list" style={{ marginTop: "1rem" }}>
            <div className="annotation">
              <h3>Study Inputs</h3>
              <p>
                Step is the output bump used by Cohen-Coon and Bump Test. Relay Amplitude is the half-swing h
                for relay autotune. Lambda Factor sets the IMC/Lambda target speed: higher is calmer, lower is faster.
              </p>
            </div>
            <div className="annotation">
              <h3>Method Character</h3>
              <p>
                Cohen-Coon and Bump Test identify process gain, lag, and deadtime from an output step.
                Ziegler-Nichols and Tyreus-Luyben use ultimate oscillation; Tyreus-Luyben is usually calmer.
                Relay Autotune estimates that oscillation from output switching. IMC/Lambda tunes toward a chosen robust response speed.
              </p>
            </div>
          </div>
          <div className="button-row" style={{ marginTop: "1rem" }}>
            <button className="button button-primary" onClick={runStudy}>Run Study</button>
            <button className="button button-secondary" disabled={!tuningResult?.recommended} onClick={applySuggestedTuning}>Apply Suggested Tuning</button>
          </div>
          {tuningResult ? <div className="annotation-list" style={{ marginTop: "1rem" }}><div className="annotation"><h3>{tuningResult.method}</h3><p>{tuningResult.note}</p></div>{tuningResult.recommended ? <div className="annotation"><h3>Recommended</h3><p>{tuningResult.recommended.algorithm} | Kp {tuningResult.recommended.kp.toFixed(3)} | Ti {tuningResult.recommended.ti?.toFixed(2) ?? "n/a"} | Td {tuningResult.recommended.td?.toFixed(2) ?? "n/a"}</p></div> : null}</div> : null}
        </article>
      </section>

      <section className="page-card">
        <div className="chip-row">
          <div>
            <p className="eyebrow">Lab Guide</p>
            <h2>Manual Output And PID Math</h2>
            <p>Reference notes for the controls above, placed after the live workspace so the graphs stay in view.</p>
          </div>
        </div>
        <div className="annotation-list" style={{ marginTop: "1rem" }}>
          <div className="annotation">
            <h3>Manual Output</h3>
            <p>
              Manual mode bypasses automatic correction and sends the fixed output through the same output
              limits, valve deadband, stiction, lag, and disturbance path as Auto mode.
            </p>
          </div>
          <div className="annotation">
            <h3>SP Filter Time</h3>
            <p>
              The setpoint filter uses SPf[k] = SPf[k-1] + dt / (Tsp + dt) * (SP - SPf[k-1]).
              Larger Tsp makes Filtered SP lag raw SP, which softens output movement and often reduces overshoot.
            </p>
          </div>
          <div className="annotation">
            <h3>PID Formula</h3>
            <p>
              Standard form: CO = Bias + Kp*e + (Kp/Ti)*integral(e dt) + Kp*Td*d(signal)/dt.
              Lower Ti gives stronger integral action; higher Td gives stronger derivative action.
            </p>
          </div>
        </div>
      </section>

      <section className="page-card">
        <div className="chip-row">
          <div>
            <p className="eyebrow">Process Effects</p>
            <h2>What Disturbances Do</h2>
            <p>How the process realism controls change the trends and the PID tuning tradeoffs.</p>
          </div>
        </div>
        <div className="annotation-list" style={{ marginTop: "1rem" }}>
          <div className="annotation">
            <h3>Disturbance And Intensity</h3>
            <p>
              Disturbance shape changes when the load enters the process; intensity scales how hard the PV is
              pushed away from setpoint and how much integral recovery is needed.
            </p>
          </div>
          <div className="annotation">
            <h3>Noise And Measurement Lag</h3>
            <p>
              Noise adds PV jitter that can drive derivative chatter. Measurement lag hides real movement from the
              controller, so aggressive Kp or short Ti can overshoot before the PV catches up.
            </p>
          </div>
          <div className="annotation">
            <h3>Actuator Deadband And Stiction</h3>
            <p>
              Actuator deadband ignores small accepted controller-output changes; stiction resists valve motion.
              Both can create stair-step valve response, cycling near setpoint, and slower disturbance recovery.
              Backlash and valve overshoot add direction-change error or extra motion where those model options are active.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function StabilityStatusWithHelp({ status }: { status: Parameters<typeof StabilityBadge>[0]["status"] }) {
  return (
    <span className="stability-status-help">
      <StabilityBadge status={status} />
      <FieldHelpTip help={stabilityVerdictHelp} />
    </span>
  );
}
