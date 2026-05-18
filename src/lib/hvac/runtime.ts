import { HvacAssessmentEngine } from "@/lib/hvac/assessment";
import { analyzeHvacDiagnostics, evaluateHvacAlarms } from "@/lib/hvac/diagnostics";
import { createDefaultPid, HvacPidController } from "@/lib/hvac/pid";
import { createHvacPlant } from "@/lib/hvac/plants";
import { HvacTrendRecorder } from "@/lib/hvac/recorder";
import { getHvacScenario, HvacScenarioEngine } from "@/lib/hvac/scenarios";
import type {
  HvacAlarm,
  HvacAssessmentSnapshot,
  HvacDiagnosticMessage,
  HvacLoopId,
  HvacPidConfig,
  HvacPidResult,
  HvacPlantCommands,
  HvacPlantModel,
  HvacPlantSnapshot,
  HvacSample,
  HvacScenarioDefinition,
  HvacTemplate
} from "@/lib/hvac/types";
import { clamp } from "@/lib/hvac/utils";

const defaultResults: Record<HvacLoopId, HvacPidResult> = {
  sat: { mv: 58, pTerm: 0, iTerm: 0, dTerm: 0, error: 0, integral: 0, saturated: false, rawMv: 58 },
  pressure: { mv: 55, pTerm: 0, iTerm: 0, dTerm: 0, error: 0, integral: 0, saturated: false, rawMv: 55 },
  outer: { mv: 68, pTerm: 0, iTerm: 0, dTerm: 0, error: 0, integral: 0, saturated: false, rawMv: 68 }
};

export interface HvacRuntime {
  plant: HvacPlantModel;
  pids: Record<HvacLoopId, HvacPidController>;
  scenarioEngine: HvacScenarioEngine;
  assessment: HvacAssessmentEngine;
  recorder: HvacTrendRecorder;
  simTime: number;
  activeLoop: HvacLoopId;
  assessmentLoop: HvacLoopId;
  cascadeEnabled: boolean;
  feedforwardEnabled: boolean;
  scenario: HvacScenarioDefinition | null;
  commands: HvacPlantCommands;
  econDamperCmd: number;
  lastResults: Record<HvacLoopId, HvacPidResult>;
  diagnostics: HvacDiagnosticMessage[];
  alarms: HvacAlarm[];
  acknowledgedAlarms: Set<string>;
  eventLabels: string[];
  scenarioEnded: boolean;
}

export interface HvacRuntimeView {
  simTime: number;
  activeLoop: HvacLoopId;
  cascadeEnabled: boolean;
  feedforwardEnabled: boolean;
  scenario: HvacScenarioDefinition | null;
  scenarioEnded: boolean;
  plant: HvacPlantSnapshot;
  pidStates: Record<HvacLoopId, HvacPidController["state"]>;
  results: Record<HvacLoopId, HvacPidResult>;
  diagnostics: HvacDiagnosticMessage[];
  alarms: HvacAlarm[];
  samples: HvacSample[];
  assessment: HvacAssessmentSnapshot;
  eventLabels: string[];
}

export function createHvacRuntime(template: HvacTemplate = "directEvap", scenarioId?: string | null): HvacRuntime {
  const runtime: HvacRuntime = {
    plant: createHvacPlant(template),
    pids: {
      sat: createDefaultPid("sat", template),
      pressure: createDefaultPid("pressure", template),
      outer: createDefaultPid("outer", template)
    },
    scenarioEngine: new HvacScenarioEngine(),
    assessment: new HvacAssessmentEngine(),
    recorder: new HvacTrendRecorder(),
    simTime: 0,
    activeLoop: "sat",
    assessmentLoop: "sat",
    cascadeEnabled: false,
    feedforwardEnabled: false,
    scenario: null,
    commands: { primaryMv: 58, pressureMv: 55, econDamperCmd: 0 },
    econDamperCmd: 0,
    lastResults: { ...defaultResults },
    diagnostics: [],
    alarms: [],
    acknowledgedAlarms: new Set(),
    eventLabels: [],
    scenarioEnded: false
  };
  const scenario = getHvacScenario(scenarioId);
  if (scenario) {
    loadHvacScenario(runtime, scenario);
  } else {
    resetHvacRuntime(runtime, template, null);
  }
  return runtime;
}

export function resetHvacRuntime(runtime: HvacRuntime, template: HvacTemplate, scenario: HvacScenarioDefinition | null) {
  runtime.plant = createHvacPlant(template, scenario?.initialState ?? {});
  runtime.pids = {
    sat: createDefaultPid("sat", template),
    pressure: createDefaultPid("pressure", template),
    outer: createDefaultPid("outer", template)
  };
  if (scenario) {
    applyScenarioPid(runtime, scenario);
  }
  const plant = runtime.plant.getSnapshot();
  runtime.pids.sat.reset(runtime.pids.sat.state.bias, runtime.plant.getLoopPv("sat"));
  runtime.pids.pressure.reset(runtime.pids.pressure.state.bias, runtime.plant.getLoopPv("pressure"));
  runtime.pids.outer.reset(runtime.pids.outer.state.bias, runtime.plant.getLoopPv("outer"));
  runtime.econDamperCmd = scenario?.initialState.econDamperActual ?? plant.econDamperActual ?? 0;
  runtime.commands = {
    primaryMv: runtime.pids.sat.state.bias,
    pressureMv: runtime.pids.pressure.state.bias,
    econDamperCmd: runtime.econDamperCmd
  };
  runtime.lastResults = {
    sat: runtime.pids.sat.result,
    pressure: runtime.pids.pressure.result,
    outer: runtime.pids.outer.result
  };
  runtime.simTime = 0;
  runtime.scenario = scenario;
  runtime.assessmentLoop = getAssessmentLoop(scenario);
  runtime.activeLoop = runtime.assessmentLoop;
  runtime.cascadeEnabled = scenario?.initialPID.outer?.mode === "auto";
  runtime.feedforwardEnabled = false;
  runtime.scenarioEngine.load(scenario);
  runtime.assessment.reset(scenario);
  runtime.recorder.reset();
  runtime.diagnostics = [];
  runtime.alarms = [];
  runtime.acknowledgedAlarms = new Set();
  runtime.eventLabels = [];
  runtime.scenarioEnded = false;
}

export function loadHvacScenario(runtime: HvacRuntime, scenario: HvacScenarioDefinition | null) {
  resetHvacRuntime(runtime, scenario?.template ?? runtime.plant.template, scenario);
}

export function setHvacTemplate(runtime: HvacRuntime, template: HvacTemplate) {
  resetHvacRuntime(runtime, template, null);
}

export function updateHvacPid(runtime: HvacRuntime, loopId: HvacLoopId, patch: Partial<HvacPidConfig>) {
  runtime.pids[loopId].set(patch);
}

export function updateHvacPlant(runtime: HvacRuntime, patch: Partial<HvacPlantSnapshot>) {
  runtime.plant.applyState(patch);
  if (typeof patch.econDamperActual === "number") {
    runtime.econDamperCmd = patch.econDamperActual;
  }
}

export function acknowledgeHvacAlarm(runtime: HvacRuntime, alarmId: string) {
  runtime.acknowledgedAlarms.add(alarmId);
}

export function stepHvacRuntime(runtime: HvacRuntime, dtSeconds = 0.1) {
  runtime.scenarioEngine.tick({
    simTime: runtime.simTime,
    plant: runtime.plant,
    pids: runtime.pids,
    setRuntimeFlag: (property, value) => {
      if (property === "cascadeEnabled") {
        runtime.cascadeEnabled = Boolean(value);
      }
      if (property === "feedforwardEnabled") {
        runtime.feedforwardEnabled = Boolean(value);
      }
    }
  });
  runtime.eventLabels = runtime.scenarioEngine.latestLabels;

  const plantSnapshot = runtime.plant.step(dtSeconds, runtime.commands);
  const satSp = runtime.cascadeEnabled
    ? clamp(
        runtime.pids.outer.compute(runtime.plant.getLoopPv("outer"), runtime.pids.outer.state.sp, dtSeconds).mv,
        runtime.pids.sat.state.outputMin === 0 ? 55 : runtime.pids.sat.state.outputMin,
        runtime.plant.template === "liquidCooled" ? 78 : 80
      )
    : runtime.pids.sat.state.sp;

  const satResult = runtime.pids.sat.compute(runtime.plant.getLoopPv("sat"), satSp, dtSeconds);
  const pressureResult = runtime.pids.pressure.compute(
    runtime.plant.getLoopPv("pressure"),
    runtime.pids.pressure.state.sp,
    dtSeconds
  );
  const outerResult = runtime.cascadeEnabled ? runtime.pids.outer.result : runtime.pids.outer.compute(runtime.plant.getLoopPv("outer"), runtime.pids.outer.state.sp, dtSeconds);
  const feedforwardMv = runtime.feedforwardEnabled ? clamp((plantSnapshot.itLoadKw - 500) / 18, -14, 18) : 0;
  const primaryMv = clamp(satResult.mv + feedforwardMv, runtime.pids.sat.state.outputMin, runtime.pids.sat.state.outputMax);

  runtime.commands = {
    primaryMv,
    pressureMv: pressureResult.mv,
    econDamperCmd: runtime.econDamperCmd
  };
  runtime.lastResults = { sat: satResult, pressure: pressureResult, outer: outerResult };
  runtime.simTime += dtSeconds;

  const alarms = evaluateHvacAlarms(plantSnapshot, satResult, runtime.acknowledgedAlarms);
  runtime.alarms = alarms;
  const sample = buildSample(runtime, plantSnapshot, runtime.activeLoop, alarms.map((alarm) => alarm.id));
  runtime.recorder.record(sample);
  const assessmentSample = buildSample(runtime, plantSnapshot, runtime.assessmentLoop, alarms.map((alarm) => alarm.id));
  runtime.assessment.sample(assessmentSample, dtSeconds, satResult.saturated);
  runtime.diagnostics = analyzeHvacDiagnostics(
    runtime.recorder.all,
    plantSnapshot,
    runtime.pids.sat.state,
    satResult
  );

  if (runtime.scenario && runtime.simTime >= runtime.scenario.durationSec) {
    runtime.scenarioEnded = true;
  }
}

export function getHvacRuntimeView(runtime: HvacRuntime, windowSeconds = 300): HvacRuntimeView {
  return {
    simTime: runtime.simTime,
    activeLoop: runtime.activeLoop,
    cascadeEnabled: runtime.cascadeEnabled,
    feedforwardEnabled: runtime.feedforwardEnabled,
    scenario: runtime.scenario,
    scenarioEnded: runtime.scenarioEnded,
    plant: runtime.plant.getSnapshot(),
    pidStates: {
      sat: runtime.pids.sat.state,
      pressure: runtime.pids.pressure.state,
      outer: runtime.pids.outer.state
    },
    results: {
      sat: runtime.lastResults.sat,
      pressure: runtime.lastResults.pressure,
      outer: runtime.lastResults.outer
    },
    diagnostics: runtime.diagnostics,
    alarms: runtime.alarms,
    samples: runtime.recorder.getWindow(windowSeconds),
    assessment: runtime.assessment.getSnapshot(),
    eventLabels: [...runtime.eventLabels]
  };
}

function applyScenarioPid(runtime: HvacRuntime, scenario: HvacScenarioDefinition) {
  for (const loopId of Object.keys(scenario.initialPID) as HvacLoopId[]) {
    const patch = scenario.initialPID[loopId];
    if (patch) {
      runtime.pids[loopId].set(patch);
    }
  }
}

function getAssessmentLoop(scenario: HvacScenarioDefinition | null): HvacLoopId {
  if (!scenario) {
    return "sat";
  }
  if (scenario.id.includes("pressure") || scenario.id.includes("static")) {
    return "pressure";
  }
  return "sat";
}

function buildSample(runtime: HvacRuntime, plant: HvacPlantSnapshot, activeLoop: HvacLoopId, alarms: string[]): HvacSample {
  const activeResult = runtime.lastResults[activeLoop];
  const activeState = runtime.pids[activeLoop].state;
  const previous = runtime.recorder.all[runtime.recorder.all.length - 1];
  const activePv = runtime.plant.getLoopPv(activeLoop);
  const activeMv = activeLoop === "sat" ? runtime.commands.primaryMv : activeResult.mv;
  return {
    simTime: runtime.simTime,
    template: plant.template,
    satSp: runtime.pids.sat.state.sp,
    satPv: runtime.plant.getLoopPv("sat"),
    satMv: runtime.commands.primaryMv,
    pressureSp: runtime.pids.pressure.state.sp,
    pressurePv: runtime.plant.getLoopPv("pressure"),
    pressureMv: runtime.commands.pressureMv,
    outerSp: runtime.pids.outer.state.sp,
    outerPv: runtime.plant.getLoopPv("outer"),
    outerMv: runtime.lastResults.outer.mv,
    activeSp: activeState.sp,
    activePv,
    activeMv,
    error: activeResult.error,
    integral: activeResult.integral,
    pTerm: activeResult.pTerm,
    iTerm: activeResult.iTerm,
    dTerm: activeResult.dTerm,
    supplyRH: plant.supplyRH,
    roomTemp: plant.roomTemp,
    staticPressure: plant.staticPressure,
    primaryMvDelta: previous ? activeMv - previous.activeMv : 0,
    alarms,
    plant
  };
}
