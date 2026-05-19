"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FieldHelpTip, FieldLabel, type FieldHelpContent } from "@/components/platform/field-help";
import { StabilityBadge } from "@/components/sim/stability-badge";
import { TrendChart } from "@/components/sim/trend-chart";
import { AppLink } from "@/lib/platform/hash-router";
import { assessControlTrendStability, type ControlTrendStability } from "@/lib/control-loop/stability";
import { buildVendorPidConfig, vendorPidProfiles, vendorPlants } from "@/lib/vendor-pid/profiles";
import {
  createVendorPidRuntime,
  getVendorPidWindow,
  proportionalBandToGain,
  stepVendorPidRuntime
} from "@/lib/vendor-pid/runtime";
import type {
  VendorPidConfig,
  VendorPidPlantDefinition,
  VendorPidPlantId,
  VendorPidProfile,
  VendorPidProfileId,
  VendorPidResult,
  VendorPidRuntime
} from "@/lib/vendor-pid/types";

const profileColors: Record<VendorPidProfileId, string> = {
  "siemens-apogee-loop": "#58a6ff",
  "siemens-tia-pid-compact": "#3fb950",
  "honeywell-comfortpoint-open": "#f0883e",
  "alc-webctrl-eikon": "#bc8cff",
  "jci-metasys-prac": "#f85149"
};

const vendorPidLessonHref = "/learn?lesson=vendor-pid-technical-background";

const vendorRunHelp: Record<"plant" | "speed" | "window", FieldHelpContent> = {
  plant: {
    title: "Plant",
    body: "Selects the simulated HVAC process each vendor controller is driving, such as supply air temperature, static pressure, or a valve loop.",
    href: "/learn?lesson=process-model-library"
  },
  speed: {
    title: "Speed",
    body: "Changes how quickly simulation time advances. Tuning behavior is still calculated from each controller profile's configured execution interval.",
    href: "/learn?lesson=toolbar-run-controls"
  },
  window: {
    title: "Trend Window",
    body: "Limits the visible trend history so operators can focus on the latest response without changing the simulation data itself.",
    href: "/learn?lesson=process-signals-trends"
  }
};

const vendorFaceplateHelp: Record<"mode" | "action" | "manualOutput" | "adaptiveMode" | "compareWith", FieldHelpContent> = {
  mode: {
    title: "Mode",
    body: "Auto lets the selected vendor PID profile calculate output. Manual holds the operator-entered output and is used to practice bumpless transfer behavior.",
    href: "/learn?lesson=operating-modes"
  },
  action: {
    title: "Action",
    body: "Direct acting increases output when PV rises above SP. Reverse acting increases output when PV falls below SP, which is common for heating or pressure loops.",
    href: "/learn?lesson=direct-vs-reverse-acting"
  },
  manualOutput: {
    title: "Manual Output",
    body: "The output forced while the controller is in Manual. The vendor profiles use this value to demonstrate tracking and bumpless return to Auto.",
    href: "/learn?lesson=anti-windup"
  },
  adaptiveMode: {
    title: "PRAC+ Adaptive",
    body: "Enables the JCI Metasys training approximation for PRAC+. Effective proportional band and integral time adjust during runtime, and derivative action is disabled.",
    href: vendorPidLessonHref
  },
  compareWith: {
    title: "Compare With",
    body: "Adds one second vendor profile to the PV/output response plots. The active faceplate and PID contribution chart still show the selected controller.",
    href: vendorPidLessonHref
  }
};

const vendorMetricHelp: Record<
  "sp" | "pv" | "mv" | "error" | "ticks" | "saturation" | "prac" | "effectivePb" | "effectiveTi",
  FieldHelpContent
> = {
  sp: {
    title: "SP",
    body: "Setpoint: the target value the controller is trying to maintain.",
    href: "/learn?lesson=process-signals-trends"
  },
  pv: {
    title: "PV",
    body: "Process Variable: the actual measured value from the simulated plant.",
    href: "/learn?lesson=process-signals-trends"
  },
  mv: {
    title: "MV",
    body: "Manipulated Variable: the controller output sent to the final element.",
    href: "/learn?lesson=faceplate-operator-controls"
  },
  error: {
    title: "Error",
    body: "Error: setpoint minus process variable. This shows how far the loop is from target.",
    href: "/learn?lesson=controller-settings-explained"
  },
  ticks: {
    title: "Ticks",
    body: "Ticks: the number of controller execution cycles since the last reset.",
    href: vendorPidLessonHref
  },
  saturation: {
    title: "Saturation",
    body: "Saturation: Active means the controller output is pinned at its minimum or maximum limit.",
    href: "/learn?lesson=anti-windup"
  },
  prac: {
    title: "PRAC+",
    body: "PRAC+: the JCI adaptive tuning status used by this training profile.",
    href: vendorPidLessonHref
  },
  effectivePb: {
    title: "Effective PB",
    body: "Effective proportional band: the active PRAC+ band. A larger band is less aggressive.",
    href: vendorPidLessonHref
  },
  effectiveTi: {
    title: "Effective Ti",
    body: "Effective integral time: the active PRAC+ integral time. Longer time integrates more slowly.",
    href: vendorPidLessonHref
  }
} as const;

const processSignalPathHref = "/learn?lesson=process-signals-trends#pv-and-secondary-pv-in-the-pid-path";

const vendorTrendSignalHelp: Record<"pv" | "secondaryPv", FieldHelpContent> = {
  pv: {
    title: "PV In The PID Path",
    body:
      "PV is the controlled measurement used by this vendor PID profile for error calculation. The controller compares SP and PV, then calculates CO/MV for the final element.",
    href: processSignalPathHref,
    linkLabel: "Open PV guide"
  },
  secondaryPv: {
    title: "Secondary PV In The PID Path",
    body:
      "Secondary PV is a diagnostic/intermediate signal. In Vendor PID Lab it represents the first lag or internal plant response before the final PV; the primary PV is still the main stability signal.",
    href: processSignalPathHref,
    linkLabel: "Open signal guide"
  }
};

function vendorNumericFieldHelp(field: { label: string; note: string; unit: string }): FieldHelpContent {
  return {
    title: field.label,
    body: `${field.note}${field.unit ? ` Unit: ${field.unit}.` : ""}`,
    href: vendorPidLessonHref
  };
}

function buildRuntimeSet(profileId: VendorPidProfileId, plantId: VendorPidPlantId, config: VendorPidConfig) {
  return Object.fromEntries(
    vendorPidProfiles.map((profile) => [
      profile.id,
      createVendorPidRuntime(profile.id, plantId, profile.id === profileId ? config : {})
    ])
  ) as Record<VendorPidProfileId, VendorPidRuntime>;
}

function formatValue(value: number, digits = 2) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function fidelityPill(fidelity: string) {
  if (fidelity === "documented") {
    return "success";
  }
  if (fidelity === "documented-plus-inferred") {
    return "warning";
  }
  return "info";
}

function tuningSummary(profileId: VendorPidProfileId, config: VendorPidConfig) {
  if (profileId === "honeywell-comfortpoint-open") {
    return `Throttling range ${formatValue(config.throttlingRange, 1)} EU maps to internal gain ${formatValue(
      proportionalBandToGain(config.throttlingRange),
      2
    )}. JACE 8000 / Niagara training mode applies a ${formatValue(config.errorRampTime, 0)} s startup error ramp.`;
  }
  if (profileId === "jci-metasys-prac") {
    return `Proportional band ${formatValue(config.proportionalBand, 1)} EU maps to gain ${formatValue(
      proportionalBandToGain(config.proportionalBand),
      2
    )}. PRAC+ disables derivative while adaptive mode is enabled.`;
  }
  if (profileId === "alc-webctrl-eikon") {
    return `Interval math executes every ${formatValue(config.interval, 1)} s. Use the comparison trend like a Ziegler-Nichols/TUNE_OL review: step, observe, then reduce aggression for HVAC comfort.`;
  }
  if (profileId === "siemens-tia-pid-compact") {
    return `Kp ${formatValue(config.kp, 2)}, Ti ${formatValue(config.ti, 0)} s, and Td ${formatValue(
      config.td,
      1
    )} s run through setpoint weighting and derivative filtering.`;
  }
  return `PG ${formatValue(config.pg, 2)}, IG ${formatValue(config.ig, 3)}, and DG ${formatValue(
    config.dg,
    1
  )} execute on a ${formatValue(config.sampleTime, 1)} s sample.`;
}

function vendorGainLanguage(profile: VendorPidProfile) {
  if (profile.computeKind === "honeywellEpid") {
    return {
      soften: "widen throttling range",
      strengthen: "narrow throttling range slightly"
    };
  }
  if (profile.computeKind === "alcInterval" || profile.computeKind === "jciPrac") {
    return {
      soften: "widen proportional band",
      strengthen: "narrow proportional band slightly"
    };
  }
  return {
    soften: "lower proportional gain",
    strengthen: "increase proportional gain slightly"
  };
}

function generateVendorFineTuneAdvice({
  stability,
  profile,
  plant,
  config,
  latest
}: {
  stability: ControlTrendStability;
  profile: VendorPidProfile;
  plant: VendorPidPlantDefinition;
  config: VendorPidConfig;
  latest: VendorPidResult;
}) {
  const gain = vendorGainLanguage(profile);
  const advice: Array<{ title: string; detail: string }> = [];
  const currentErrorAbs = Math.abs(stability.currentError);
  const meaningfulError = currentErrorAbs > Math.max((plant.displayMax - plant.displayMin) * 0.04, 0.05);
  const cycling = stability.oscillationClass === "growing" || stability.oscillationClass === "sustained";
  const outputLimited = stability.saturationPctOfRun > 12 || latest.saturated;

  if (config.mode === "manual") {
    advice.push({
      title: "Manual mode is holding response",
      detail:
        "The vendor PID is not correcting automatically. Use Manual for positioning, then return to Auto and verify the output transfers without a bump."
    });
  }

  if (stability.status === "unstable") {
    if (cycling || stability.overshootPct > 12) {
      advice.push({
        title: "Back away from hunting",
        detail: `The PV response is moving past the safe training limit. ${gain.soften}, increase integral time, or reduce derivative action before trying to speed up the loop.`
      });
    } else if (outputLimited) {
      advice.push({
        title: "Recover final-element authority",
        detail:
          "The output is pinned at a limit. Check output limits, bias/startup value, actuator authority, and process load before changing vendor PID constants."
      });
    } else {
      advice.push({
        title: "Restore convergence",
        detail: `The PV is not moving toward SP fast enough. If the output has room to move, ${gain.strengthen} or shorten integral time in small steps.`
      });
    }
  } else if (stability.status === "marginal") {
    if (cycling || stability.overshootPct > 12) {
      advice.push({
        title: "Add damping margin",
        detail: `The loop is close to hunting. ${gain.soften} or increase integral time, then compare the next trend against the same plant.`
      });
    } else if (outputLimited) {
      advice.push({
        title: "Check output limits",
        detail:
          "The loop is mostly controlled but spends too much time at an output limit. Confirm bias and output range before making the PID more aggressive."
      });
    } else if (meaningfulError) {
      advice.push({
        title: "Tighten recovery carefully",
        detail: `The PV is calm but still offset from SP. ${gain.strengthen} or shorten integral time slightly, then watch overshoot and valve travel.`
      });
    } else {
      advice.push({
        title: "Keep watching the trend",
        detail:
          "The response is close to stable. Let another trend window build before changing settings, especially on slower HVAC plants."
      });
    }
  } else {
    advice.push({
      title: "Balanced vendor response",
      detail:
        "The visible PV trend is settled enough for operator practice. Use comparison mode to see whether another vendor profile reaches the same target with less output travel."
    });
  }

  if (profile.computeKind === "jciPrac" && config.adaptiveMode) {
    advice.push({
      title: "PRAC+ is adapting",
      detail:
        "Watch Effective PB and Effective Ti. If PRAC+ is slowing hunting, let it settle before making manual tuning changes."
    });
  }

  if (!latest.executedTick) {
    advice.push({
      title: "Respect the execution interval",
      detail:
        "This vendor profile holds output between controller execution ticks. Judge response over several ticks, not from one sample."
    });
  }

  return advice.slice(0, 4);
}

export function VendorPidLab() {
  const [profileId, setProfileId] = useState<VendorPidProfileId>("jci-metasys-prac");
  const [plantId, setPlantId] = useState<VendorPidPlantId>("supplyAirTemp");
  const [config, setConfig] = useState(() => buildVendorPidConfig("jci-metasys-prac", "supplyAirTemp"));
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [trendWindow, setTrendWindow] = useState(600);
  const [compareProfileId, setCompareProfileId] = useState<VendorPidProfileId | "none">("none");
  const [renderTick, setRenderTick] = useState(0);
  const runtimesRef = useRef(buildRuntimeSet(profileId, plantId, config));

  const activeProfile = vendorPidProfiles.find((profile) => profile.id === profileId) ?? vendorPidProfiles[0];
  const compareProfile =
    compareProfileId === "none"
      ? null
      : vendorPidProfiles.find((profile) => profile.id === compareProfileId) ?? null;
  const activePlant = vendorPlants.find((plant) => plant.id === plantId) ?? vendorPlants[0];
  const activeRuntime = runtimesRef.current[profileId];
  const activeSamples = getVendorPidWindow(activeRuntime, trendWindow);
  const latest = activeRuntime.lastResult;
  const activeStability = useMemo(
    () =>
      assessControlTrendStability({
        samples: activeSamples.map((sample) => ({
          time: sample.time,
          sp: sample.sp,
          pv: sample.pv,
          mv: sample.mv,
          saturated: sample.saturated
        })),
        span: Math.max(activePlant.displayMax - activePlant.displayMin, 1)
      }),
    [activePlant.displayMax, activePlant.displayMin, activeSamples]
  );
  const vendorFineTuneAdvice = useMemo(
    () =>
      generateVendorFineTuneAdvice({
        stability: activeStability,
        profile: activeProfile,
        plant: activePlant,
        config,
        latest
      }),
    [activePlant, activeProfile, activeStability, config, latest]
  );

  const resetRuntimes = (nextProfileId = profileId, nextPlantId = plantId, nextConfig = config) => {
    runtimesRef.current = buildRuntimeSet(nextProfileId, nextPlantId, nextConfig);
    setRenderTick((current) => current + 1);
  };

  useEffect(() => {
    const timerId = window.setInterval(() => {
      if (isRunning) {
        for (let index = 0; index < speed; index += 1) {
          for (const runtime of Object.values(runtimesRef.current)) {
            stepVendorPidRuntime(runtime);
          }
        }
      }
      setRenderTick((current) => current + 1);
    }, 100);
    return () => window.clearInterval(timerId);
  }, [isRunning, speed]);

  const applyProfile = (nextProfileId: VendorPidProfileId) => {
    const nextConfig = buildVendorPidConfig(nextProfileId, plantId);
    setProfileId(nextProfileId);
    setCompareProfileId((current) => (current === nextProfileId ? "none" : current));
    setConfig(nextConfig);
    resetRuntimes(nextProfileId, plantId, nextConfig);
  };

  const applyPlant = (nextPlantId: VendorPidPlantId) => {
    const nextConfig = buildVendorPidConfig(profileId, nextPlantId);
    setPlantId(nextPlantId);
    setConfig(nextConfig);
    resetRuntimes(profileId, nextPlantId, nextConfig);
  };

  const updateConfig = (patch: Partial<VendorPidConfig>) => {
    const nextConfig = { ...config, ...patch };
    setConfig(nextConfig);
    resetRuntimes(profileId, plantId, nextConfig);
  };

  const responseSeries = useMemo(() => {
    const selectedSeries = [
      {
        label: compareProfile ? `${activeProfile.shortLabel} PV` : "PV",
        color: profileColors[profileId],
        help: vendorTrendSignalHelp.pv,
        data: activeSamples.map((sample) => ({ x: sample.time, y: sample.pv }))
      },
      { label: "SP", color: "#f8fafc", dashed: true, data: activeSamples.map((sample) => ({ x: sample.time, y: sample.sp })) }
    ];

    if (!compareProfile) {
      return selectedSeries;
    }

    const comparisonSamples = getVendorPidWindow(runtimesRef.current[compareProfile.id], trendWindow);

    return [
      ...selectedSeries,
      {
        label: `${compareProfile.shortLabel} PV`,
        color: profileColors[compareProfile.id],
        dashed: true,
        help: vendorTrendSignalHelp.pv,
        data: comparisonSamples.map((sample) => ({ x: sample.time, y: sample.pv }))
      }
    ];
  }, [activeProfile.shortLabel, activeSamples, compareProfile, profileId, trendWindow]);

  const actuatorSeries = useMemo(() => {
    const selectedSeries = [
      {
        label: compareProfile ? `${activeProfile.shortLabel} CO` : "CO",
        color: "#fb7185",
        axis: "right" as const,
        data: activeSamples.map((sample) => ({ x: sample.time, y: sample.mv }))
      },
      {
        label: compareProfile ? `${activeProfile.shortLabel} Valve` : "Valve",
        color: "#38bdf8",
        dashed: true,
        axis: "right" as const,
        data: activeSamples.map((sample) => ({ x: sample.time, y: sample.valvePosition }))
      },
      {
        label: compareProfile ? `${activeProfile.shortLabel} Secondary PV` : "Secondary PV",
        color: "#c084fc",
        help: vendorTrendSignalHelp.secondaryPv,
        data: activeSamples.map((sample) => ({ x: sample.time, y: sample.secondaryPv }))
      }
    ];

    if (!compareProfile) {
      return selectedSeries;
    }

    const comparisonSamples = getVendorPidWindow(runtimesRef.current[compareProfile.id], trendWindow);

    return [
      ...selectedSeries,
      {
        label: `${compareProfile.shortLabel} CO`,
        color: "#fbbf24",
        dashed: true,
        axis: "right" as const,
        data: comparisonSamples.map((sample) => ({ x: sample.time, y: sample.mv }))
      },
      {
        label: `${compareProfile.shortLabel} Valve`,
        color: "#94a3b8",
        dashed: true,
        axis: "right" as const,
        data: comparisonSamples.map((sample) => ({ x: sample.time, y: sample.valvePosition }))
      },
      {
        label: `${compareProfile.shortLabel} Secondary PV`,
        color: profileColors[compareProfile.id],
        dashed: true,
        help: vendorTrendSignalHelp.secondaryPv,
        data: comparisonSamples.map((sample) => ({ x: sample.time, y: sample.secondaryPv }))
      }
    ];
  }, [activeProfile.shortLabel, activeSamples, compareProfile, trendWindow]);

  const termSeries = [
    { label: "P", color: "#f97316", data: activeSamples.map((sample) => ({ x: sample.time, y: sample.pTerm })) },
    { label: "I", color: "#22c55e", data: activeSamples.map((sample) => ({ x: sample.time, y: sample.iTerm })) },
    { label: "D", color: "#60a5fa", data: activeSamples.map((sample) => ({ x: sample.time, y: sample.dTerm })) },
    { label: "Total", color: "#f8fafc", dashed: true, data: activeSamples.map((sample) => ({ x: sample.time, y: sample.rawMv })) }
  ];

  return (
    <main className="page-stack vendor-lab">
      <section className="page-card vendor-hero">
        <div>
          <p className="eyebrow">Vendor PID Training</p>
          <h2>Vendor PID Lab</h2>
          <p>
            Compare realistic training profiles for Siemens, Honeywell JACE 8000, ALC WebCTRL/EIKON, and JCI
            Metasys without changing the existing lab or HVAC simulator.
          </p>
        </div>
        <div className="vendor-run-controls">
          <label className="field">
            <FieldLabel help={vendorRunHelp.plant}>Plant</FieldLabel>
            <select value={plantId} onChange={(event) => applyPlant(event.target.value as VendorPidPlantId)}>
              {vendorPlants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <FieldLabel help={vendorRunHelp.speed}>Speed</FieldLabel>
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              {[1, 4, 10, 30].map((value) => (
                <option key={value} value={value}>
                  {value}x
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <FieldLabel help={vendorRunHelp.window}>Window</FieldLabel>
            <select value={trendWindow} onChange={(event) => setTrendWindow(Number(event.target.value))}>
              <option value={300}>5 min</option>
              <option value={600}>10 min</option>
              <option value={900}>15 min</option>
              <option value={0}>Full</option>
            </select>
          </label>
          <button className="button button-primary" onClick={() => setIsRunning((current) => !current)}>
            {isRunning ? "Pause" : "Run"}
          </button>
          <button className="button button-secondary" onClick={() => resetRuntimes()}>
            Reset
          </button>
        </div>
      </section>

      <section className="vendor-profile-strip">
        {vendorPidProfiles.map((profile) => (
          <button
            key={profile.id}
            className={`vendor-profile-card${profile.id === profileId ? " active" : ""}`}
            onClick={() => applyProfile(profile.id)}
          >
            <span className="eyebrow">{profile.vendor}</span>
            <strong>{profile.shortLabel}</strong>
            <span>{profile.family}</span>
          </button>
        ))}
      </section>

      <section className="vendor-lab-grid">
        <aside className="panel vendor-panel">
          <div className="chip-row">
            <div>
              <p className="eyebrow">Faceplate</p>
              <h2>{activeProfile.shortLabel}</h2>
            </div>
            <span className={`pill ${fidelityPill(activeProfile.fidelity)}`}>{activeProfile.fidelity.replaceAll("-", " ")}</span>
          </div>

          <div className="field-grid">
            <label className="field">
              <FieldLabel help={vendorFaceplateHelp.mode}>Mode</FieldLabel>
              <select value={config.mode} onChange={(event) => updateConfig({ mode: event.target.value as VendorPidConfig["mode"] })}>
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className="field">
              <FieldLabel help={vendorFaceplateHelp.action}>Action</FieldLabel>
              <select value={config.action} onChange={(event) => updateConfig({ action: event.target.value as VendorPidConfig["action"] })}>
                <option value="direct">Direct Acting</option>
                <option value="reverse">Reverse Acting</option>
              </select>
            </label>
            {config.mode === "manual" ? (
              <label className="field">
                <FieldLabel help={vendorFaceplateHelp.manualOutput}>Manual Output</FieldLabel>
                <input
                  type="number"
                  value={config.manualOutput}
                  min={config.outputMin}
                  max={config.outputMax}
                  step={1}
                  onChange={(event) => updateConfig({ manualOutput: Number(event.target.value) })}
                />
              </label>
            ) : null}
            {profileId === "jci-metasys-prac" ? (
              <label className="vendor-check">
                <input
                  type="checkbox"
                  checked={config.adaptiveMode}
                  onChange={(event) => updateConfig({ adaptiveMode: event.target.checked })}
                />
                <span>PRAC+ adaptive</span>
                <FieldHelpTip help={vendorFaceplateHelp.adaptiveMode} />
              </label>
            ) : null}
          </div>

          <div className="field-grid">
            {activeProfile.fieldDefinitions.map((field) => (
              <label className="field" key={field.key}>
                <FieldLabel help={vendorNumericFieldHelp(field)}>{field.label}</FieldLabel>
                <input
                  type="number"
                  value={Number(config[field.key])}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(event) => updateConfig({ [field.key]: Number(event.target.value) } as Partial<VendorPidConfig>)}
                />
              </label>
            ))}
          </div>

          <div className="annotation-list">
            <div className="annotation">
              <h3>Training Translation</h3>
              <p>{tuningSummary(profileId, config)}</p>
            </div>
            {activeProfile.behaviorNotes.map((note) => (
              <div key={note} className="annotation">
                <p>{note}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="vendor-center">
          <div className="vendor-metrics-row" aria-label="Vendor PID live operating values">
            <Metric label="SP" value={`${formatValue(activeRuntime.setpoint, activePlant.precision)} ${activePlant.units}`} description={vendorMetricHelp.sp} />
            <Metric label="PV" value={`${formatValue(activeRuntime.plantState.pv, activePlant.precision)} ${activePlant.units}`} description={vendorMetricHelp.pv} />
            <Metric label="MV" value={`${formatValue(latest.mv, 1)}%`} description={vendorMetricHelp.mv} />
            <Metric label="Error" value={formatValue(latest.error, activePlant.precision)} description={vendorMetricHelp.error} />
            <Metric label="Ticks" value={latest.tickCount} description={vendorMetricHelp.ticks} />
            <Metric label="Saturation" value={latest.saturated ? "Active" : "Clear"} description={vendorMetricHelp.saturation} />
          </div>
          {profileId === "jci-metasys-prac" ? (
            <div className="vendor-metrics-row vendor-metrics-row-secondary" aria-label="JCI PRAC adaptive values">
              <Metric label="PRAC+" value={latest.pracStatus} description={vendorMetricHelp.prac} />
              <Metric
                label="Eff PB"
                description={vendorMetricHelp.effectivePb}
                value={
                  latest.effectiveProportionalBand === null
                    ? "--"
                    : formatValue(latest.effectiveProportionalBand, activePlant.precision)
                }
              />
              <Metric
                label="Eff Ti"
                description={vendorMetricHelp.effectiveTi}
                value={
                  latest.effectiveIntegralTime === null
                    ? "--"
                    : `${formatValue(latest.effectiveIntegralTime, 0)}s`
                }
              />
            </div>
          ) : null}

          <TrendChart
            title="PV / SP"
            subtitle={
              compareProfile
                ? `${activeProfile.shortLabel} compared with ${compareProfile.shortLabel} on ${activePlant.label}.`
                : `${activePlant.label}: ${activePlant.summary}`
            }
            series={responseSeries}
          />
          <TrendChart
            title="CO / Valve / Secondary PV"
            subtitle={compareProfile ? "Output and secondary process response for the selected and comparison profiles." : undefined}
            series={actuatorSeries}
            rightAxis={{ min: config.outputMin, max: config.outputMax, label: "Output %" }}
          />
          <TrendChart title="P / I / D Contributions" series={termSeries} />
          <article className="panel">
            <div className="chip-row">
              <div>
                <p className="eyebrow">PID Stability</p>
                <h2>Vendor Loop Verdict</h2>
              </div>
              <StabilityBadge status={activeStability.status} />
            </div>
            <div className="annotation-list" style={{ marginTop: "1rem" }}>
              <div className="annotation">
                <h3>
                  {activeProfile.shortLabel} on {activePlant.label}
                </h3>
                <p>
                  Error {formatValue(activeStability.currentError, activePlant.precision)} {activePlant.units} | Overshoot{" "}
                  {formatValue(activeStability.overshootPct, 1)}% | Saturation{" "}
                  {formatValue(activeStability.saturationPctOfRun, 1)}% | Oscillation{" "}
                  {activeStability.oscillationClass}
                </p>
              </div>
              {activeStability.advisoryMessages.slice(0, 3).map((message, index) => (
                <div key={`${message}-${index}`} className="annotation">
                  <p>{message}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <p className="eyebrow">Fine-Tune Assistant</p>
            <h2>Vendor PID Coaching</h2>
            <div className="advice-list">
              {vendorFineTuneAdvice.map((item) => (
                <div key={item.title} className="advice-item">
                  <strong>{item.title}</strong>
                  <p className="muted" style={{ marginTop: "0.35rem" }}>{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="panel vendor-panel">
          <div className="chip-row">
            <div>
              <p className="eyebrow">Comparison</p>
              <h2>Vendor Response</h2>
            </div>
          </div>

          <label className="field">
            <FieldLabel help={vendorFaceplateHelp.compareWith}>Compare With</FieldLabel>
            <select
              value={compareProfileId}
              onChange={(event) => setCompareProfileId(event.target.value as VendorPidProfileId | "none")}
            >
              <option value="none">None</option>
              {vendorPidProfiles
                .filter((profile) => profile.id !== profileId)
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.shortLabel}
                  </option>
                ))}
            </select>
          </label>

          <div className="vendor-compare-list">
            {vendorPidProfiles.map((profile) => {
              const runtime = runtimesRef.current[profile.id];
              return (
                <button
                  key={profile.id}
                  className={`vendor-compare-row${profile.id === profileId ? " active" : ""}`}
                  onClick={() => applyProfile(profile.id)}
                >
                  <span className="vendor-color-dot" style={{ background: profileColors[profile.id] }} />
                  <strong>{profile.shortLabel}</strong>
                  <span>
                    {profile.id === profileId ? "Selected" : compareProfileId === profile.id ? "Comparing" : "Available"} | PV{" "}
                    {formatValue(runtime.plantState.pv, activePlant.precision)} | MV {formatValue(runtime.lastResult.mv, 1)}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="annotation-list">
            <div className="annotation">
              <h3>Sources</h3>
              <div className="vendor-source-list">
                <AppLink href="/learn?lesson=vendor-pid-technical-background">
                  Technical background lesson
                </AppLink>
                {activeProfile.sourceLinks.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="annotation">
              <h3>Scope Guard</h3>
              <p>
                These profiles are operator-training simulations. They model public behavior and field-realistic tuning
                feel, not proprietary firmware source code.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value, description }: { label: string; value: string | number; description: FieldHelpContent }) {
  const valueText = String(value);
  const sizeClass = valueText.length > 14 ? " dense-value" : valueText.length > 9 ? " compact-value" : "";

  return (
    <div
      className={`metric-card vendor-metric-card${sizeClass}`}
      aria-label={`${label}: ${valueText}. ${description.body}`}
    >
      <p className="eyebrow vendor-metric-label">
        <span>{label}</span>
        <FieldHelpTip help={description} />
      </p>
      <h3>{valueText}</h3>
    </div>
  );
}
