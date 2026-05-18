"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StabilityBadge } from "@/components/sim/stability-badge";
import { TrendChart } from "@/components/sim/trend-chart";
import { assessControlTrendStability } from "@/lib/control-loop/stability";
import {
  acknowledgeHvacAlarm,
  createHvacRuntime,
  getHvacRuntimeView,
  loadHvacScenario,
  setHvacTemplate,
  stepHvacRuntime,
  updateHvacPid,
  updateHvacPlant,
  type HvacRuntimeView
} from "@/lib/hvac/runtime";
import { generateHvacFineTuneAdvice } from "@/lib/hvac/advice";
import { getStoredHvacStage, hvacScenarios, storeHvacStage } from "@/lib/hvac/scenarios";
import {
  dewPointF,
  enthalpyBtuPerLb,
  humidityRatioFromDryWet,
  relativeHumidityFromDbW,
  wetBulbFromDryBulbRh
} from "@/lib/hvac/psychrometrics";
import { round } from "@/lib/hvac/utils";
import type {
  HvacAlarm,
  HvacLoopId,
  HvacPidConfig,
  HvacPlantSnapshot,
  HvacScenarioDefinition,
  HvacTemplate
} from "@/lib/hvac/types";

const loopLabels: Record<HvacLoopId, string> = {
  sat: "SAT / Primary",
  pressure: "Pressure",
  outer: "Room Cascade"
};

const templateLabels: Record<HvacTemplate, string> = {
  directEvap: "Direct Evap",
  airCooled: "Air Cooled",
  liquidCooled: "Liquid Cooled"
};

const glossary = [
  ["Cascade", "An outer loop writes a setpoint for a faster inner loop."],
  ["Deadband", "A small error zone where the controller intentionally does nothing."],
  ["Derivative on measurement", "Derivative reacts to PV movement, avoiding setpoint kick."],
  ["IAE", "Integral of absolute error; lower is usually better."],
  ["Split range", "One control output is mapped across multiple actuators."]
] as const;

export function HvacSimulatorWorkspace() {
  const runtimeRef = useRef(createHvacRuntime("directEvap"));
  const [trendWindow, setTrendWindow] = useState(300);
  const [view, setView] = useState<HvacRuntimeView>(() => getHvacRuntimeView(runtimeRef.current, trendWindow));
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [scenarioLevel, setScenarioLevel] = useState<0 | 1 | 2 | 3 | 4>(1);
  const [teachingStage, setTeachingStage] = useState(1);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [completedScenario, setCompletedScenario] = useState<HvacScenarioDefinition | null>(null);
  const [cursorMode, setCursorMode] = useState<"one" | "two">("two");
  const [activeCursor, setActiveCursor] = useState<"a" | "b">("a");
  const [cursors, setCursors] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });

  const refresh = useCallback(() => {
    setView(getHvacRuntimeView(runtimeRef.current, trendWindow));
  }, [trendWindow]);

  useEffect(() => {
    setTeachingStage(getStoredHvacStage());
    setShowWelcome(window.localStorage.getItem("pidtrainer.hvac.welcomeDismissed") !== "true");
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      const runtime = runtimeRef.current;
      if (isRunning && !runtime.scenarioEnded) {
        for (let index = 0; index < speed; index += 1) {
          stepHvacRuntime(runtime);
        }
      }
      setView(getHvacRuntimeView(runtime, trendWindow));
    }, 100);
    return () => window.clearInterval(timerId);
  }, [isRunning, speed, trendWindow]);

  useEffect(() => {
    if (!view.scenarioEnded || !view.scenario) {
      return;
    }
    setIsRunning(false);
    setCompletedScenario((current) => current ?? view.scenario);
    const nextStage = Math.min(7, Math.max(teachingStage, view.scenario.level + 1));
    if (nextStage !== teachingStage) {
      setTeachingStage(nextStage);
      storeHvacStage(nextStage);
    }
  }, [teachingStage, view.scenario, view.scenarioEnded]);

  const activeLoop = view.activeLoop;
  const activePid = view.pidStates[activeLoop];
  const activeResult = view.results[activeLoop];
  const plant = view.plant;
  const visibleScenarios = useMemo(
    () => hvacScenarios.filter((scenario) => scenario.level === scenarioLevel),
    [scenarioLevel]
  );
  const fineTuneAdvice = useMemo(() => generateHvacFineTuneAdvice(view), [view]);
  const stageAllowsIntegral = teachingStage >= 2;
  const stageAllowsDerivative = teachingStage >= 3;
  const stageAllowsCascade = teachingStage >= 4;
  const stageAllowsFeedforward = teachingStage >= 6;
  const activePv = activeLoop === "pressure"
    ? plant.template === "liquidCooled" ? plant.secondaryPressurePv : plant.staticPressurePv
    : activeLoop === "outer"
      ? plant.template === "liquidCooled" ? plant.rackInletTemp : plant.roomTemp
      : plant.template === "liquidCooled" ? plant.cduSupplyTempPv : plant.supplyAirTempPv;
  const calculatedWetBulb = wetBulbFromDryBulbRh(plant.outdoorDryBulb, plant.outdoorRH);
  const rhFromWetBulb = relativeHumidityFromDbW(
    plant.outdoorDryBulb,
    humidityRatioFromDryWet(plant.outdoorDryBulb, plant.outdoorWetBulb)
  );
  const activePidSpan =
    activeLoop === "pressure"
      ? plant.template === "liquidCooled" ? 60 : 2
      : plant.template === "liquidCooled" ? 60 : 70;
  const activeStability = useMemo(
    () =>
      assessControlTrendStability({
        samples: view.samples.map((sample) => ({
          time: sample.simTime,
          sp: sample.activeSp,
          pv: sample.activePv,
          mv: sample.activeMv,
          saturated:
            sample.activeMv <= activePid.outputMin + 0.001 ||
            sample.activeMv >= activePid.outputMax - 0.001
        })),
        span: activePidSpan
      }),
    [activePid.outputMax, activePid.outputMin, activePidSpan, view.samples]
  );

  const mainSeries = [
    { label: "SP", color: "#58a6ff", dashed: true, data: view.samples.map((sample) => ({ x: sample.simTime, y: sample.activeSp })) },
    { label: "PV", color: "#3fb950", data: view.samples.map((sample) => ({ x: sample.simTime, y: sample.activePv })) },
    { label: "MV", color: "#f0883e", dashed: true, data: view.samples.map((sample) => ({ x: sample.simTime, y: sample.activeMv })) }
  ];
  const errorSeries = [
    { label: "Error", color: "#f85149", data: view.samples.map((sample) => ({ x: sample.simTime, y: sample.error })) },
    { label: "Integral", color: "#bc8cff", dashed: true, data: view.samples.map((sample) => ({ x: sample.simTime, y: sample.integral })) }
  ];
  const termSeries = [
    { label: "P", color: "#00d4ff", data: view.samples.map((sample) => ({ x: sample.simTime, y: sample.pTerm })) },
    { label: "I", color: "#d29922", data: view.samples.map((sample) => ({ x: sample.simTime, y: sample.iTerm })) },
    { label: "D", color: "#bc8cff", data: view.samples.map((sample) => ({ x: sample.simTime, y: sample.dTerm })) }
  ];
  const chartCursorProps = {
    cursors: { a: cursors.a, b: cursors.b, enabledTwo: cursorMode === "two" },
    onPlaceCursor: (time: number) => {
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
    },
    activeCursor
  };

  const updatePid = (patch: Partial<HvacPidConfig>) => {
    updateHvacPid(runtimeRef.current, activeLoop, patch);
    refresh();
  };

  const updatePlant = (patch: Partial<HvacPlantSnapshot>) => {
    updateHvacPlant(runtimeRef.current, patch);
    refresh();
  };

  const loadScenario = (scenario: HvacScenarioDefinition | null) => {
    loadHvacScenario(runtimeRef.current, scenario);
    setCompletedScenario(null);
    setCursors({ a: null, b: null });
    setActiveCursor("a");
    setIsRunning(true);
    refresh();
  };

  return (
    <main className="hvac-shell">
      <section className="page-card hvac-topbar">
        <div>
          <p className="eyebrow">Data Center HVAC</p>
          <h2>HVAC PID Simulator</h2>
          <p>
            Tune supply temperature, pressure, and room cascade loops across direct evaporative, air-cooled,
            and liquid-cooled training plants.
          </p>
        </div>
        <div className="hvac-top-actions">
          <label className="field compact-field">
            <span className="label">Template</span>
            <select
              value={plant.template}
              onChange={(event) => {
                setHvacTemplate(runtimeRef.current, event.target.value as HvacTemplate);
                setCompletedScenario(null);
                setCursors({ a: null, b: null });
                setActiveCursor("a");
                refresh();
              }}
            >
              {Object.entries(templateLabels).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field compact-field">
            <span className="label">Speed</span>
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              {[1, 4, 10, 30].map((value) => (
                <option key={value} value={value}>{value}x</option>
              ))}
            </select>
          </label>
          <label className="field compact-field">
            <span className="label">Trend</span>
            <select value={trendWindow} onChange={(event) => setTrendWindow(Number(event.target.value))}>
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
              <option value={900}>15 min</option>
              <option value={1800}>30 min</option>
            </select>
          </label>
          <label className="field compact-field">
            <span className="label">Cursors</span>
            <select
              value={cursorMode}
              onChange={(event) => {
                const next = event.target.value as "one" | "two";
                setCursorMode(next);
                if (next === "one") {
                  setCursors((current) => ({ ...current, b: null }));
                  setActiveCursor("a");
                }
              }}
            >
              <option value="one">One</option>
              <option value="two">Two</option>
            </select>
          </label>
          <button className="button button-primary" onClick={() => setIsRunning((current) => !current)}>
            {isRunning ? "Pause" : "Run"}
          </button>
          <button className="button button-secondary" onClick={() => loadScenario(view.scenario)}>
            Reset
          </button>
          <button className="button button-secondary" onClick={() => setShowGlossary(true)}>
            Glossary
          </button>
          <button className="button button-secondary" onClick={() => setShowHelp(true)}>
            Help
          </button>
        </div>
      </section>

      <section className="hvac-grid">
        <aside className="panel hvac-panel hvac-left">
          <p className="eyebrow">Control Loops</p>
          <div className="hvac-loop-tabs">
            {(Object.keys(loopLabels) as HvacLoopId[]).map((loopId) => (
              <button
                key={loopId}
                className={`button ${activeLoop === loopId ? "button-primary" : "button-secondary"}`}
                disabled={loopId === "outer" && !stageAllowsCascade}
                onClick={() => {
                  runtimeRef.current.activeLoop = loopId;
                  refresh();
                }}
              >
                {loopLabels[loopId]}
              </button>
            ))}
          </div>

          <div className="hvac-spv-grid">
            <label>
              <span>SP</span>
              <input
                type="number"
                value={round(activePid.sp, 2)}
                onChange={(event) => updatePid({ sp: Number(event.target.value) })}
              />
            </label>
            <div>
              <span>PV</span>
              <strong>{round(activePv, activeLoop === "pressure" ? 3 : 1)}</strong>
            </div>
            <div>
              <span>MV</span>
              <strong>{round(activeResult.mv, 1)}%</strong>
            </div>
          </div>

          <div className="button-row">
            <button
              className={`button ${activePid.mode === "manual" ? "button-primary" : "button-secondary"}`}
              onClick={() => updatePid({ mode: "manual", manualOutput: activeResult.mv })}
            >
              Manual
            </button>
            <button
              className={`button ${activePid.mode === "auto" ? "button-primary" : "button-secondary"}`}
              onClick={() => updatePid({ mode: "auto" })}
            >
              Auto
            </button>
            <button
              className={`button ${view.cascadeEnabled ? "button-primary" : "button-secondary"}`}
              disabled={!stageAllowsCascade}
              onClick={() => {
                runtimeRef.current.cascadeEnabled = !runtimeRef.current.cascadeEnabled;
                updateHvacPid(runtimeRef.current, "outer", { mode: runtimeRef.current.cascadeEnabled ? "auto" : "manual" });
                refresh();
              }}
            >
              Cascade
            </button>
            <button
              className={`button ${view.feedforwardEnabled ? "button-primary" : "button-secondary"}`}
              disabled={!stageAllowsFeedforward}
              onClick={() => {
                runtimeRef.current.feedforwardEnabled = !runtimeRef.current.feedforwardEnabled;
                refresh();
              }}
            >
              FF
            </button>
          </div>

          {activePid.mode === "manual" ? (
            <NumericSlider
              label="Manual MV"
              value={activePid.manualOutput}
              min={activePid.outputMin}
              max={activePid.outputMax}
              step={0.5}
              onChange={(value) => updatePid({ manualOutput: value })}
            />
          ) : null}

          <div className="hvac-control-stack">
            <NumericSlider label="Kp" value={activePid.kp} min={0} max={activeLoop === "pressure" ? 60 : 20} step={0.1} onChange={(value) => updatePid({ kp: value })} />
            <NumericSlider label="Ki" value={activePid.ki} min={0} max={2} step={0.005} disabled={!stageAllowsIntegral} onChange={(value) => updatePid({ ki: value })} />
            <NumericSlider label="Kd" value={activePid.kd} min={0} max={60} step={0.1} disabled={!stageAllowsDerivative} onChange={(value) => updatePid({ kd: value })} />
          </div>

          <details className="hvac-details">
            <summary>Advanced Settings</summary>
            <div className="field-grid">
              <label className="field"><span className="label">Output Min</span><input type="number" value={activePid.outputMin} onChange={(event) => updatePid({ outputMin: Number(event.target.value) })} /></label>
              <label className="field"><span className="label">Output Max</span><input type="number" value={activePid.outputMax} onChange={(event) => updatePid({ outputMax: Number(event.target.value) })} /></label>
              <label className="field"><span className="label">Deadband</span><input type="number" step="0.05" value={activePid.deadband} onChange={(event) => updatePid({ deadband: Number(event.target.value) })} /></label>
              <label className="field"><span className="label">Rate Limit</span><input type="number" step="0.5" value={activePid.rateLimit} onChange={(event) => updatePid({ rateLimit: Number(event.target.value) })} /></label>
              <label className="field"><span className="label">Anti-Windup</span><select value={activePid.antiWindup} onChange={(event) => updatePid({ antiWindup: event.target.value as HvacPidConfig["antiWindup"] })}><option value="clamp">Clamp</option><option value="back-calc">Back-calc</option><option value="off">Off</option></select></label>
              <label className="field"><span className="label">Derivative N</span><input type="number" value={activePid.derivN} disabled={!stageAllowsDerivative} onChange={(event) => updatePid({ derivN: Number(event.target.value) })} /></label>
            </div>
            <div className="hvac-check-row">
              <label><input type="checkbox" checked={activePid.derivOnMeas} disabled={!stageAllowsDerivative} onChange={(event) => updatePid({ derivOnMeas: event.target.checked })} /> Derivative on PV</label>
              <label><input type="checkbox" checked={activePid.reverseAction} onChange={(event) => updatePid({ reverseAction: event.target.checked })} /> Reverse action</label>
            </div>
          </details>

          <details className="hvac-details" open>
            <summary>Plant Disturbances</summary>
            {plant.template !== "liquidCooled" ? (
              <>
                <NumericSlider
                  label="OAT"
                  value={plant.outdoorDryBulb}
                  min={50}
                  max={115}
                  step={1}
                  onChange={(value) =>
                    updatePlant({
                      outdoorDryBulb: value,
                      outdoorWetBulb: wetBulbFromDryBulbRh(value, plant.outdoorRH)
                    })
                  }
                />
                <NumericSlider
                  label="Outdoor RH"
                  value={plant.outdoorRH}
                  min={5}
                  max={100}
                  step={1}
                  onChange={(value) =>
                    updatePlant({
                      outdoorRH: value,
                      outdoorWetBulb: wetBulbFromDryBulbRh(plant.outdoorDryBulb, value)
                    })
                  }
                />
                <NumericSlider
                  label="WBT"
                  value={plant.outdoorWetBulb}
                  min={40}
                  max={90}
                  step={1}
                  onChange={(value) =>
                    updatePlant({
                      outdoorWetBulb: value,
                      outdoorRH: relativeHumidityFromDbW(
                        plant.outdoorDryBulb,
                        humidityRatioFromDryWet(plant.outdoorDryBulb, value)
                      )
                    })
                  }
                />
                <div className="hvac-calc-note">
                  <strong>Wet-bulb calculation</strong>
                  <span>
                    From OAT {round(plant.outdoorDryBulb, 0)} deg F and RH {round(plant.outdoorRH, 0)}%, the Stull
                    approximation gives WBT {round(calculatedWetBulb, 1)} deg F. Current WBT implies RH {round(rhFromWetBulb, 0)}%.
                  </span>
                </div>
                <NumericSlider label="Pad Fouling" value={plant.padFouling} min={0} max={0.5} step={0.01} disabled={plant.template !== "directEvap"} onChange={(value) => updatePlant({ padFouling: value })} />
                <NumericSlider label="Econ Damper" value={runtimeRef.current.econDamperCmd} min={0} max={100} step={1} disabled={plant.template !== "directEvap"} onChange={(value) => { runtimeRef.current.econDamperCmd = value; refresh(); }} />
              </>
            ) : (
              <NumericSlider label="Coolant In" value={plant.coolantInTemp} min={45} max={75} step={1} onChange={(value) => updatePlant({ coolantInTemp: value })} />
            )}
            <NumericSlider label="IT Load" value={plant.itLoadKw} min={100} max={1100} step={10} onChange={(value) => updatePlant({ itLoadKw: value })} />
            <NumericSlider label="Delay" value={plant.transportDelayS} min={0} max={90} step={1} onChange={(value) => updatePlant({ transportDelayS: value })} />
            <label className="hvac-check-row">
              <input type="checkbox" checked={plant.bypassDamperJammed} onChange={(event) => updatePlant({ bypassDamperJammed: event.target.checked })} />
              Bypass jam
            </label>
          </details>
        </aside>

        <section className="hvac-center">
          <HvacSchematic
            plant={plant}
            alarms={view.alarms}
            activeLoop={view.activeLoop}
            cascadeEnabled={view.cascadeEnabled}
            feedforwardEnabled={view.feedforwardEnabled}
          />
          <div className="hvac-trends">
            <TrendChart title="SP / PV / MV" series={mainSeries} {...chartCursorProps} />
            <TrendChart title="Error / Integral" series={errorSeries} {...chartCursorProps} />
            <TrendChart title="PID Terms" series={termSeries} {...chartCursorProps} />
          </div>
          <article className="panel">
            <div className="chip-row">
              <div>
                <p className="eyebrow">PID Stability</p>
                <h2>Active Loop Verdict</h2>
              </div>
              <StabilityBadge status={activeStability.status} />
            </div>
            <div className="annotation-list" style={{ marginTop: "1rem" }}>
              <div className="annotation">
                <h3>{loopLabels[activeLoop]}</h3>
                <p>
                  Error {round(activeStability.currentError, activeLoop === "pressure" ? 3 : 2)} | Overshoot{" "}
                  {round(activeStability.overshootPct, 1)}% | Saturation {round(activeStability.saturationPctOfRun, 1)}%
                </p>
              </div>
              {activeStability.advisoryMessages.slice(0, 3).map((message) => (
                <div key={message} className="annotation">
                  <p>{message}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <p className="eyebrow">HVAC Fine-Tune Assistant</p>
            <h2>Operator Coaching</h2>
            <div className="advice-list">
              {fineTuneAdvice.map((item) => (
                <div key={item.title} className="advice-item">
                  <strong>{item.title}</strong>
                  <p className="muted" style={{ marginTop: "0.35rem" }}>{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="panel hvac-panel hvac-right">
          <p className="eyebrow">Explain-Why</p>
          <div className="hvac-message-list">
            {view.diagnostics.map((item) => (
              <div key={item.id} className={`hvac-message ${item.severity}`}>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </div>
            ))}
          </div>

          <p className="eyebrow">Performance</p>
          <div className="hvac-kpi-grid">
            <Kpi label="Score" value={view.assessment.score === null ? "--" : `${view.assessment.score}/100`} />
            <Kpi label="Overshoot" value={`${round(view.assessment.overshootPct, 1)}%`} />
            <Kpi label="Settle" value={view.assessment.settlingTimeS === null ? "--" : `${round(view.assessment.settlingTimeS, 0)}s`} />
            <Kpi label="RMSE" value={round(view.assessment.rmse, 2)} />
            <Kpi label="IAE" value={round(view.assessment.iae, 1)} />
            <Kpi label="MV Var" value={round(view.assessment.actuatorMovement, 1)} />
          </div>

          <p className="eyebrow">Equipment</p>
          <EquipmentRows plant={plant} />

          <p className="eyebrow">Alarms</p>
          <div className="hvac-alarm-list">
            {view.alarms.length ? view.alarms.map((alarm) => (
              <button
                key={alarm.id}
                className={`hvac-alarm ${alarm.priority}${alarm.acknowledged ? " acknowledged" : ""}`}
                onClick={() => {
                  acknowledgeHvacAlarm(runtimeRef.current, alarm.id);
                  refresh();
                }}
              >
                <strong>{alarm.title}</strong>
                <span>{alarm.acknowledged ? "Acknowledged" : alarm.detail}</span>
              </button>
            )) : <div className="muted">No active alarms</div>}
          </div>

          <PsychroMini plant={plant} />
        </aside>
      </section>

      <section className="panel hvac-bottom">
        <div className="hvac-level-tabs">
          {[1, 2, 3, 4, 0].map((level) => (
            <button
              key={level}
              className={`button ${scenarioLevel === level ? "button-primary" : "button-secondary"}`}
              onClick={() => setScenarioLevel(level as 0 | 1 | 2 | 3 | 4)}
            >
              {level === 0 ? "Free Mode" : `Level ${level}`}
            </button>
          ))}
        </div>
        <div className="hvac-scenario-row">
          {scenarioLevel === 0 ? (
            <button className="hvac-scenario-card" onClick={() => loadScenario(null)}>
              <p className="eyebrow">Free Mode</p>
              <h3>Open training plant</h3>
              <p>Run the selected HVAC template without a score timer.</p>
            </button>
          ) : visibleScenarios.map((scenario) => {
            const locked = scenario.level > Math.max(1, Math.min(4, teachingStage));
            return (
              <button
                key={scenario.id}
                className="hvac-scenario-card"
                disabled={locked}
                onClick={() => loadScenario(scenario)}
              >
                <p className="eyebrow">{templateLabels[scenario.template]}</p>
                <h3>{scenario.title}</h3>
                <p>{locked ? "Locked by teaching stage" : scenario.subtitle}</p>
              </button>
            );
          })}
        </div>
        <div className="hvac-assessment-strip">
          <div>
            <p className="eyebrow">Assessment</p>
            <h3>{view.scenario?.title ?? "Free Mode"}</h3>
            <p>{view.scenario?.hint ?? "Select a scenario or keep experimenting freely."}</p>
          </div>
          <div className="hvac-score-display">{view.assessment.score ?? "--"}/100</div>
          <div className="button-row">
            <button className="button button-primary" onClick={() => setIsRunning(true)}>Start</button>
            <button className="button button-secondary" onClick={() => setIsRunning(false)}>End</button>
            <button className="button button-secondary" onClick={() => loadScenario(view.scenario)}>Replay</button>
          </div>
        </div>
      </section>

      {showWelcome ? (
        <HvacModal title="Welcome To HVAC Simulator" onClose={() => {
          window.localStorage.setItem("pidtrainer.hvac.welcomeDismissed", "true");
          setShowWelcome(false);
        }}>
          <p>Choose a plant template, tune the active loop, and use scenarios when you want scored practice.</p>
          <p>The current PID lab remains unchanged; this simulator runs as its own HVAC training workspace.</p>
        </HvacModal>
      ) : null}

      {showGlossary ? (
        <HvacModal title="Glossary" onClose={() => setShowGlossary(false)}>
          <div className="hvac-glossary">
            {glossary.map(([term, definition]) => (
              <div key={term}>
                <strong>{term}</strong>
                <p>{definition}</p>
              </div>
            ))}
          </div>
        </HvacModal>
      ) : null}

      {showHelp ? (
        <HvacModal title="Panel Help" onClose={() => setShowHelp(false)}>
          <p>Use the left panel to change PID settings and plant disturbances. The center panel shows plant motion and trends. The right panel explains diagnostics, alarms, and performance.</p>
          <p>
            Wet-bulb temperature is estimated from outdoor dry-bulb temperature and relative humidity with the Stull
            approximation: Tw(C) = T atan(0.151977 sqrt(RH + 8.313659)) + atan(T + RH) - atan(RH - 1.676331)
            + 0.00391838 RH^1.5 atan(0.023101 RH) - 4.686035. The result is converted back to deg F and clamped
            so it cannot exceed dry-bulb temperature.
          </p>
        </HvacModal>
      ) : null}

      {completedScenario ? (
        <HvacModal title="Scenario Complete" onClose={() => setCompletedScenario(null)}>
          <p>{completedScenario.title} finished with score {view.assessment.score ?? "--"}/100.</p>
          <p>Benchmark score: {completedScenario.benchmarkScore}/100. Suggested benchmark tuning: Kp {completedScenario.benchmarkTuning.kp}, Ki {completedScenario.benchmarkTuning.ki}, Kd {completedScenario.benchmarkTuning.kd}.</p>
        </HvacModal>
      ) : null}
    </main>
  );
}

function NumericSlider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={`hvac-slider-row${disabled ? " disabled" : ""}`}>
      <label>{label}</label>
      <input type="range" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
      <input type="number" value={round(value, step < 0.01 ? 3 : step < 1 ? 2 : 1)} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

type HmiSeverity = "normal" | "warning" | "critical";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function hasActiveAlarm(alarms: HvacAlarm[], id: string) {
  return alarms.some((alarm) => alarm.id === id && alarm.active);
}

function HmiTag({
  x,
  y,
  label,
  value,
  unit,
  severity = "normal",
  width = 112
}: {
  x: number;
  y: number;
  label: string;
  value: string | number;
  unit?: string;
  severity?: HmiSeverity;
  width?: number;
}) {
  return (
    <g className={`hmi-tag ${severity}`} transform={`translate(${x} ${y})`}>
      <rect className="hmi-tag-box" x="0" y="0" width={width} height="44" rx="3" />
      <text className="hmi-tag-label" x="8" y="15">{label}</text>
      <text className="hmi-tag-value" x="8" y="34">
        {value}{unit ? ` ${unit}` : ""}
      </text>
    </g>
  );
}

function HmiEquipmentBox({
  x,
  y,
  width,
  height,
  label,
  value,
  severity = "normal"
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value?: string;
  severity?: HmiSeverity;
}) {
  return (
    <g className={`hmi-equipment ${severity}`} transform={`translate(${x} ${y})`}>
      <rect className="hmi-equipment-box" x="0" y="0" width={width} height={height} rx="3" />
      <text className="hmi-equipment-label" x={width / 2} y={value ? height / 2 - 2 : height / 2 + 5} textAnchor="middle">{label}</text>
      {value ? <text className="hmi-equipment-value" x={width / 2} y={height / 2 + 17} textAnchor="middle">{value}</text> : null}
    </g>
  );
}

function HmiActuatorBar({
  x,
  y,
  label,
  value,
  severity = "normal",
  width = 122
}: {
  x: number;
  y: number;
  label: string;
  value: number;
  severity?: HmiSeverity;
  width?: number;
}) {
  const fillWidth = (clampPercent(value) / 100) * width;
  return (
    <g className={`hmi-actuator ${severity}`} transform={`translate(${x} ${y})`}>
      <text className="hmi-small-label" x="0" y="-6">{label}</text>
      <rect className="hmi-bar-track" x="0" y="0" width={width} height="10" rx="2" />
      <rect className="hmi-bar-fill" x="0" y="0" width={fillWidth} height="10" rx="2" />
      <text className="hmi-bar-value" x={width + 8} y="9">{round(value, 0)}%</text>
    </g>
  );
}

function HmiDamper({
  x,
  y,
  label,
  value,
  severity = "normal",
  labelPosition = "below"
}: {
  x: number;
  y: number;
  label: string;
  value: number;
  severity?: HmiSeverity;
  labelPosition?: "above" | "below";
}) {
  const bladeAngle = -42 + (clampPercent(value) / 100) * 84;
  const positionState = value > 5 ? "open" : "closed";
  const labelY = labelPosition === "above" ? -14 : 51;
  const valueY = labelPosition === "above" ? 1 : 66;
  return (
    <g className={`hmi-damper ${severity} ${positionState}`} transform={`translate(${x} ${y})`}>
      <rect className="hmi-device-frame" x="0" y="0" width="54" height="34" rx="3" />
      <line className="hmi-damper-blade" x1="8" x2="46" y1="17" y2="17" transform={`rotate(${bladeAngle} 27 17)`} />
      <text className="hmi-device-label" x="27" y={labelY} textAnchor="middle">{label}</text>
      <text className="hmi-device-value" x="27" y={valueY} textAnchor="middle">{round(value, 0)}%</text>
    </g>
  );
}

function HmiRotary({
  x,
  y,
  label,
  value,
  severity = "normal"
}: {
  x: number;
  y: number;
  label: string;
  value: number;
  severity?: HmiSeverity;
}) {
  return (
    <g className={`hmi-rotary ${severity}`} transform={`translate(${x} ${y})`}>
      <circle className="hmi-rotary-shell" cx="34" cy="34" r="31" />
      <path className="hmi-rotary-mark" d="M34 34 L55 26 L47 46 Z" />
      <path className="hmi-rotary-mark" d="M34 34 L16 49 L14 25 Z" />
      <circle className="hmi-rotary-hub" cx="34" cy="34" r="5" />
      <text className="hmi-device-label" x="34" y="84" textAnchor="middle">{label}</text>
      <text className="hmi-device-value" x="34" y="99" textAnchor="middle">{round(value, 0)}%</text>
    </g>
  );
}

function HmiValve({
  x,
  y,
  label,
  value,
  severity = "normal"
}: {
  x: number;
  y: number;
  label: string;
  value: number;
  severity?: HmiSeverity;
}) {
  return (
    <g className={`hmi-valve ${severity}`} transform={`translate(${x} ${y})`}>
      <path className="hmi-valve-body" d="M0 12 L28 0 V24 Z M56 12 L28 0 V24 Z" />
      <line className="hmi-valve-stem" x1="28" x2="28" y1="-18" y2="0" />
      <rect className="hmi-valve-actuator" x="12" y="-32" width="32" height="14" rx="2" />
      <text className="hmi-device-label" x="28" y="49" textAnchor="middle">{label}</text>
      <text className="hmi-device-value" x="28" y="64" textAnchor="middle">{round(value, 0)}%</text>
    </g>
  );
}

function HmiCallout({
  x,
  y,
  title,
  detail,
  severity
}: {
  x: number;
  y: number;
  title: string;
  detail: string;
  severity: Exclude<HmiSeverity, "normal">;
}) {
  return (
    <g className={`hmi-callout ${severity}`} transform={`translate(${x} ${y})`}>
      <rect className="hmi-callout-box" x="0" y="0" width="158" height="30" rx="3" />
      <path className="hmi-callout-symbol" d="M13 7 L22 23 H4 Z" />
      <text className="hmi-callout-title" x="30" y="13">{title}</text>
      <text className="hmi-callout-detail" x="30" y="24">{detail}</text>
    </g>
  );
}

function HmiControlLoop({
  x,
  y,
  loop,
  pv,
  controller,
  finalElement,
  active,
  enabled = true,
  note,
  width = 628
}: {
  x: number;
  y: number;
  loop: string;
  pv: string;
  controller: string;
  finalElement: string;
  active: boolean;
  enabled?: boolean;
  note?: string;
  width?: number;
}) {
  return (
    <g className={`hmi-control-loop${active ? " active" : ""}${enabled ? "" : " disabled"}`} transform={`translate(${x} ${y})`}>
      <rect className="hmi-control-loop-box" x="0" y="0" width={width} height={note ? 44 : 34} rx="3" />
      <text className="hmi-control-loop-name" x="10" y="21">{loop}</text>
      <text className="hmi-control-loop-text" x="112" y="21">PV: {pv}</text>
      <path className="hmi-control-link" d="M246 17 H282" />
      <text className="hmi-control-loop-text" x="292" y="21">{controller}</text>
      <path className="hmi-control-link" d="M398 17 H434" />
      <text className="hmi-control-loop-text" x="444" y="21">FE: {finalElement}</text>
      {active ? <text className="hmi-control-badge" x={width - 64} y="21">SELECTED</text> : null}
      {note ? <text className="hmi-control-note" x="112" y="37">{note}</text> : null}
    </g>
  );
}

function HvacSchematic({
  plant,
  alarms,
  activeLoop,
  cascadeEnabled,
  feedforwardEnabled
}: {
  plant: HvacPlantSnapshot;
  alarms: HvacAlarm[];
  activeLoop: HvacLoopId;
  cascadeEnabled: boolean;
  feedforwardEnabled: boolean;
}) {
  const highSat = hasActiveAlarm(alarms, "high-sat");
  const highRoom = hasActiveAlarm(alarms, "high-room");
  const highHumidity = hasActiveAlarm(alarms, "high-rh");
  const pressureAlarm = hasActiveAlarm(alarms, "low-pressure") || hasActiveAlarm(alarms, "high-pressure");
  const padAlarm = hasActiveAlarm(alarms, "pad-fouling") || plant.padFouling > 0.3;
  const satSeverity: HmiSeverity = highSat ? "critical" : plant.supplyAirTempPv > 76 ? "warning" : "normal";
  const roomSeverity: HmiSeverity = highRoom ? "critical" : plant.roomTemp > 83 || plant.rackInletTemp > 83 ? "warning" : "normal";
  const humiditySeverity: HmiSeverity = highHumidity ? "critical" : plant.supplyRH > 80 ? "warning" : "normal";
  const pressureSeverity: HmiSeverity = pressureAlarm ? "warning" : "normal";
  const loadSeverity: HmiSeverity = plant.itLoadKw > 850 ? "warning" : "normal";

  if (plant.template === "liquidCooled") {
    const liquidPressureSeverity: HmiSeverity =
      plant.secondaryPressurePv < 12 || plant.secondaryPressurePv > 28 ? "warning" : "normal";
    const liquidCallouts = [
      roomSeverity === "critical" ? { severity: "critical" as const, title: "ALARM", detail: "RACK TEMP HIGH" } : null,
      liquidPressureSeverity === "warning" ? { severity: "warning" as const, title: "WARN", detail: "PRESSURE DEVIATION" } : null,
      loadSeverity === "warning" ? { severity: "warning" as const, title: "WARN", detail: "IT LOAD HIGH" } : null
    ].filter((item): item is { severity: Exclude<HmiSeverity, "normal">; title: string; detail: string } => item !== null);

    return (
      <article className="panel hvac-schematic">
        <p className="eyebrow">ISA-101 Inspired Operator View</p>
        <svg viewBox="0 0 760 440" role="img" aria-label="Liquid cooled CDU HMI schematic">
          <rect className="hmi-screen" x="12" y="12" width="736" height="416" rx="4" />
          <text className="hmi-title" x="32" y="42">LIQUID COOLING CDU - UNIT DETAIL</text>
          <text className="hmi-mode-label" x="32" y="62">NORMAL STATES ARE GRAY | ABNORMAL STATES ARE MARKED</text>

          <path className={`hmi-process-line ${liquidPressureSeverity}`} d="M132 150 H302" />
          <path className={`hmi-process-line ${satSeverity}`} d="M438 150 H592" />
          <path className="hmi-process-line" d="M592 206 H438 M302 206 H132" />
          <path className="hmi-flow-arrow" d="M286 142 l16 8 l-16 8" />
          <path className="hmi-flow-arrow" d="M574 142 l16 8 l-16 8" />
          <path className="hmi-flow-arrow reverse" d="M150 198 l-16 8 l16 8" />

          <HmiEquipmentBox x={48} y={114} width={84} height={74} label="RACK" value={`${round(plant.rackInletTemp, 1)} deg F`} severity={roomSeverity} />
          <HmiEquipmentBox x={302} y={96} width={136} height={126} label="CDU HX" value={`${round(plant.cduSupplyTempPv, 1)} deg F`} severity={satSeverity} />
          <HmiRotary x={594} y={114} label="PUMP" value={plant.pumpVFDActual} severity={liquidPressureSeverity} />
          <HmiValve x={494} y={238} label="BYPASS" value={plant.bypassValveActual} severity={plant.bypassValveActual > 80 ? "warning" : "normal"} />

          <HmiTag x={38} y={236} label="RACK INLET" value={round(plant.rackInletTemp, 1)} unit="deg F" severity={roomSeverity} />
          <HmiTag x={166} y={236} label="CDU SUPPLY" value={round(plant.cduSupplyTempPv, 1)} unit="deg F" severity={satSeverity} />
          <HmiTag x={294} y={236} label="SECONDARY DP" value={round(plant.secondaryPressurePv, 1)} unit="psid" severity={liquidPressureSeverity} />
          <HmiTag x={422} y={236} label="COOLANT IN" value={round(plant.coolantInTemp, 1)} unit="deg F" />
          <HmiTag x={550} y={236} label="IT LOAD" value={round(plant.itLoadKw, 0)} unit="kW" severity={loadSeverity} />
          <HmiControlLoop
            x={38}
            y={296}
            loop="SAT"
            pv="CDU Supply Temp"
            controller="PID-SAT"
            finalElement="Bypass Valve inverse"
            active={activeLoop === "sat"}
            note="Higher cooling demand drives bypass closed."
          />
          <HmiControlLoop
            x={38}
            y={344}
            loop="PRESS"
            pv="Secondary DP"
            controller="PID-PRESS"
            finalElement="Pump VFD"
            active={activeLoop === "pressure"}
          />
          <HmiControlLoop
            x={38}
            y={388}
            loop="CASCADE"
            pv="Rack Inlet"
            controller="Room PID"
            finalElement="SAT SP"
            active={activeLoop === "outer"}
            enabled={cascadeEnabled}
          />

          {liquidCallouts.map((callout, index) => (
            <HmiCallout key={`${callout.title}-${callout.detail}`} x={560} y={40 + index * 36} {...callout} />
          ))}
        </svg>
      </article>
    );
  }

  if (plant.template === "airCooled") {
    const valveSeverity: HmiSeverity = plant.valveActual > 92 ? "warning" : "normal";
    const airCallouts = [
      highSat ? { severity: "critical" as const, title: "ALARM", detail: "SUPPLY TEMP HIGH" } : null,
      roomSeverity === "critical" ? { severity: "critical" as const, title: "ALARM", detail: "ROOM TEMP HIGH" } : null,
      pressureSeverity === "warning" ? { severity: "warning" as const, title: "WARN", detail: "STATIC PRESSURE" } : null,
      loadSeverity === "warning" ? { severity: "warning" as const, title: "WARN", detail: "IT LOAD HIGH" } : null
    ].filter((item): item is { severity: Exclude<HmiSeverity, "normal">; title: string; detail: string } => item !== null);

    return (
      <article className="panel hvac-schematic">
        <p className="eyebrow">ISA-101 Inspired Operator View</p>
        <svg viewBox="0 0 760 440" role="img" aria-label="Air cooled coil HMI schematic">
          <rect className="hmi-screen" x="12" y="12" width="736" height="416" rx="4" />
          <text className="hmi-title" x="32" y="42">AIR-COOLED COIL - UNIT DETAIL</text>
          <text className="hmi-mode-label" x="32" y="62">CHW VALVE AND FAN STATUS WITH ABNORMAL EMPHASIS</text>

          <path className="hmi-process-line" d="M88 154 H250" />
          <path className={`hmi-process-line ${satSeverity}`} d="M378 154 H582" />
          <path className="hmi-process-line return" d="M628 108 V246 H92 V204" />
          <path className="hmi-flow-arrow" d="M232 146 l16 8 l-16 8" />
          <path className="hmi-flow-arrow" d="M562 146 l16 8 l-16 8" />

          <HmiEquipmentBox x={48} y={118} width={92} height={72} label="RETURN" value={`${round(plant.returnAirTemp, 1)} deg F`} />
          <HmiEquipmentBox x={250} y={92} width={128} height={124} label="CHW COIL" value={`${round(plant.chilledWaterSupplyTemp, 1)} deg F`} severity={valveSeverity} />
          <HmiValve x={286} y={254} label="CHW VLV" value={plant.valveActual} severity={valveSeverity} />
          <HmiRotary x={584} y={120} label="SUP FAN" value={plant.fanVFDActual} severity={pressureSeverity} />
          <HmiEquipmentBox x={640} y={118} width={78} height={74} label="ROOM" value={`${round(plant.roomTemp, 1)} deg F`} severity={roomSeverity} />

          <HmiTag x={38} y={236} label="RAT" value={round(plant.returnAirTemp, 1)} unit="deg F" />
          <HmiTag x={166} y={236} label="SAT" value={round(plant.supplyAirTempPv, 1)} unit="deg F" severity={satSeverity} />
          <HmiTag x={422} y={236} label="STATIC" value={round(plant.staticPressurePv, 2)} unit="in WC" severity={pressureSeverity} />
          <HmiTag x={550} y={236} label="ROOM" value={round(plant.roomTemp, 1)} unit="deg F" severity={roomSeverity} />
          <HmiControlLoop
            x={38}
            y={296}
            loop="SAT"
            pv="Supply Air Temp"
            controller="PID-SAT"
            finalElement="CHW Valve"
            active={activeLoop === "sat"}
          />
          <HmiControlLoop
            x={38}
            y={340}
            loop="PRESS"
            pv="Static Pressure"
            controller="PID-PRESS"
            finalElement="Supply Fan VFD"
            active={activeLoop === "pressure"}
          />
          <HmiControlLoop
            x={38}
            y={384}
            loop="CASCADE"
            pv="Room Temp"
            controller="Room PID"
            finalElement="SAT SP"
            active={activeLoop === "outer"}
            enabled={cascadeEnabled}
          />

          {airCallouts.map((callout, index) => (
            <HmiCallout key={`${callout.title}-${callout.detail}`} x={560} y={40 + index * 36} {...callout} />
          ))}
        </svg>
      </article>
    );
  }

  const bypassSeverity: HmiSeverity = plant.bypassDamperJammed ? "critical" : "normal";
  const padSeverity: HmiSeverity = padAlarm ? "warning" : "normal";
  const econSeverity: HmiSeverity = plant.outdoorDryBulb > 65 && plant.econDamperActual > 5 ? "warning" : "normal";
  const directCallouts = [
    plant.bypassDamperJammed ? { severity: "critical" as const, title: "FAULT", detail: "BYPASS DAMPER JAM" } : null,
    highSat ? { severity: "critical" as const, title: "ALARM", detail: "SUPPLY TEMP HIGH" } : null,
    highHumidity ? { severity: "critical" as const, title: "ALARM", detail: "SUPPLY RH HIGH" } : null,
    padAlarm ? { severity: "warning" as const, title: "WARN", detail: "EVAP MEDIA FOULING" } : null,
    econSeverity === "warning" ? { severity: "warning" as const, title: "WARN", detail: "ECON LOCKOUT" } : null
  ].filter((item): item is { severity: Exclude<HmiSeverity, "normal">; title: string; detail: string } => item !== null);

  return (
    <article className="panel hvac-schematic">
      <p className="eyebrow">ISA-101 Inspired Operator View</p>
      <svg viewBox="0 0 760 464" role="img" aria-label="Direct evaporative cooling HMI schematic">
        <rect className="hmi-screen" x="12" y="12" width="736" height="440" rx="4" />
        <text className="hmi-title" x="32" y="42">DIRECT EVAPORATIVE COOLING - UNIT DETAIL</text>
        <text className="hmi-mode-label" x="32" y="62">COLOR IS RESERVED FOR WARNINGS, ALARMS, AND FAULTS</text>

        <path className="hmi-process-line" d="M78 162 H134" />
        <path className={`hmi-process-line ${padSeverity}`} d="M184 162 H244" />
        <path className={`hmi-process-line ${satSeverity}`} d="M300 162 H584" />
        <path className="hmi-process-line return" d="M646 118 V250 H96 V210" />
        <path className="hmi-flow-arrow" d="M226 154 l16 8 l-16 8" />
        <path className="hmi-flow-arrow" d="M566 154 l16 8 l-16 8" />
        <path className="hmi-flow-arrow reverse" d="M114 242 l-16 8 l16 8" />

        <HmiEquipmentBox x={36} y={122} width={76} height={80} label="OA" value={`${round(plant.outdoorDryBulb, 0)} deg F`} />
        <HmiEquipmentBox x={134} y={102} width={86} height={120} label="EVAP MEDIA" value={`${round((1 - plant.padFouling) * 100, 0)}% avail`} severity={padSeverity} />
        <HmiDamper x={246} y={102} label="FACE" value={plant.faceDamperActual} />
        <HmiDamper x={338} y={210} label="BYPASS" value={plant.bypassDamperActual} severity={bypassSeverity} labelPosition="above" />
        <HmiDamper x={438} y={78} label="ECON" value={plant.econDamperActual} severity={econSeverity} />
        <HmiRotary x={586} y={128} label="SUP FAN" value={plant.fanVFDActual} severity={pressureSeverity} />
        <HmiEquipmentBox x={640} y={132} width={78} height={78} label="ROOM" value={`${round(plant.roomTemp, 1)} deg F`} severity={roomSeverity} />

        <HmiTag x={38} y={258} label="OAT DIST" value={round(plant.outdoorDryBulb, 0)} unit="deg F" />
        <HmiTag x={166} y={258} label="WBT DIST" value={round(plant.outdoorWetBulb, 0)} unit="deg F" />
        <HmiTag x={294} y={258} label="SAT PV" value={round(plant.supplyAirTempPv, 1)} unit="deg F" severity={satSeverity} />
        <HmiTag x={422} y={258} label="STATIC PV" value={round(plant.staticPressurePv, 2)} unit="in WC" severity={pressureSeverity} />
        <HmiTag x={550} y={258} label="SUPPLY RH" value={round(plant.supplyRH, 0)} unit="%" severity={humiditySeverity} />
        <HmiControlLoop
          x={38}
          y={316}
          loop="SAT"
          pv="SAT Sensor"
          controller="PID-SAT"
          finalElement="Face open / Bypass inverse"
          active={activeLoop === "sat"}
          note={feedforwardEnabled ? "IT load feedforward trims primary MV." : "OAT/WBT are disturbances, not the controlled PV."}
        />
        <HmiControlLoop
          x={38}
          y={364}
          loop="PRESS"
          pv="Static Pressure"
          controller="PID-PRESS"
          finalElement="Supply Fan VFD"
          active={activeLoop === "pressure"}
        />
        <HmiControlLoop
          x={38}
          y={408}
          loop="CASCADE"
          pv="Room Temp"
          controller="Room PID"
          finalElement="SAT SP"
          active={activeLoop === "outer"}
          enabled={cascadeEnabled}
        />

        {directCallouts.map((callout, index) => (
          <HmiCallout key={`${callout.title}-${callout.detail}`} x={560} y={40 + index * 36} {...callout} />
        ))}
      </svg>
    </article>
  );
}

function EquipmentRows({ plant }: { plant: HvacPlantSnapshot }) {
  const rows = plant.template === "liquidCooled"
    ? [
        ["Pump VFD", plant.pumpVFDActual, "%"],
        ["Bypass Valve", plant.bypassValveActual, "%"],
        ["CDU Supply", plant.cduSupplyTempPv, "deg F"],
        ["Rack Inlet", plant.rackInletTemp, "deg F"],
        ["Pressure", plant.secondaryPressurePv, "psid"]
      ]
    : [
        ["Face Damper", plant.faceDamperActual, "%"],
        ["Bypass Damper", plant.bypassDamperActual, "%"],
        ["Fan VFD", plant.fanVFDActual, "%"],
        ["Econ Damper", plant.econDamperActual, "%"],
        ["Supply RH", plant.supplyRH, "%"],
        ["Room Temp", plant.roomTemp, "deg F"]
      ];
  return (
    <div className="hvac-equipment-list">
      {rows.map(([label, value, unit]) => (
        <div key={label} className="hvac-equipment-row">
          <span>{label}</span>
          <strong>{round(Number(value), unit === "%" ? 0 : 1)} {unit}</strong>
          {unit === "%" ? <div className="hvac-bar"><span style={{ width: `${Number(value)}%` }} /></div> : null}
        </div>
      ))}
    </div>
  );
}

function PsychroMini({ plant }: { plant: HvacPlantSnapshot }) {
  const dewPoint = dewPointF(plant.supplyAirTemp, plant.supplyHumidityRatio);
  const enthalpy = enthalpyBtuPerLb(plant.supplyAirTemp, plant.supplyHumidityRatio);
  const x = 24 + Math.min(188, Math.max(0, (plant.supplyAirTemp - 45) / 60 * 188));
  const y = 118 - Math.min(90, Math.max(0, plant.supplyRH / 100 * 90));
  return (
    <div className="hvac-psychro">
      <p className="eyebrow">Psychrometric Mini</p>
      <svg viewBox="0 0 240 150" role="img" aria-label="Psychrometric mini chart">
        <rect x="20" y="20" width="196" height="104" rx="6" fill="#0c1018" stroke="#30363d" />
        {[25, 50, 75].map((rh) => (
          <line key={rh} x1="20" x2="216" y1={124 - rh / 100 * 104} y2={124 - rh / 100 * 104} stroke="rgba(148,163,184,.18)" />
        ))}
        <circle cx={x} cy={y} r="6" fill="#58a6ff" />
        <text x="22" y="142" fill="#8b949e">DP {round(dewPoint, 1)} deg F | h {round(enthalpy, 1)}</text>
      </svg>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="hvac-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HvacModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="hvac-modal-backdrop" role="dialog" aria-modal="true">
      <div className="panel hvac-modal">
        <div className="chip-row">
          <h2>{title}</h2>
          <button className="button button-secondary" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
