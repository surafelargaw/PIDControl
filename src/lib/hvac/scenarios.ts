import type { HvacLoopId, HvacPidConfig, HvacPlantSnapshot, HvacScenarioDefinition, HvacScenarioEvent } from "@/lib/hvac/types";
import { lerp } from "@/lib/hvac/utils";

export const HVAC_PROGRESS_KEY = "pidtrainer.hvac.progress.v1";

export const hvacScenarios: HvacScenarioDefinition[] = [
  {
    id: "level1_first_contact",
    level: 1,
    title: "First Contact",
    subtitle: "P-only SAT control",
    template: "directEvap",
    durationSec: 600,
    hint: "Start with Kp near 2.5 and watch the remaining offset before adding integral later.",
    tutorial: "Bring supply air temperature toward setpoint using proportional action only.",
    initialState: { outdoorDryBulb: 95, outdoorWetBulb: 62, itLoadKw: 400, roomTemp: 82, returnAirTemp: 82 },
    initialPID: { sat: { kp: 2.5, ki: 0, kd: 0, sp: 68, bias: 58, mode: "auto" } },
    disturbances: [],
    criteria: { maxOvershootPct: 30, settlingTimeS: 300, maxRmse: 5, alarmLimit: 5 },
    scoringWeights: { settling: 0.25, overshoot: 0.2, rmse: 0.35, alarms: 0.2 },
    benchmarkTuning: { kp: 2.5, ki: 0, kd: 0 },
    benchmarkScore: 72
  },
  {
    id: "level1_static_pressure",
    level: 1,
    title: "Fan Static Basics",
    subtitle: "Hold pressure without fan hunting",
    template: "directEvap",
    durationSec: 480,
    hint: "Use lower pressure-loop gain than SAT gain; pressure reacts fast.",
    tutorial: "Tune the pressure loop while the SAT loop runs with a calm default setting.",
    initialState: { outdoorDryBulb: 92, outdoorWetBulb: 69, itLoadKw: 450 },
    initialPID: { pressure: { kp: 28, ki: 0.4, kd: 0, sp: 0.45, bias: 58, mode: "auto" } },
    disturbances: [{ atSimTimeS: 180, target: "plant", property: "faceDamperActual", value: 92, label: "VAV boxes opened" }],
    criteria: { maxOvershootPct: 35, settlingTimeS: 220, maxRmse: 0.08, alarmLimit: 4 },
    scoringWeights: { settling: 0.25, overshoot: 0.2, rmse: 0.35, alarms: 0.2 },
    benchmarkTuning: { kp: 28, ki: 0.4, kd: 0 },
    benchmarkScore: 76
  },
  {
    id: "level1_hot_day",
    level: 1,
    title: "Hot Day Load Step",
    subtitle: "Recover from IT load increase",
    template: "directEvap",
    durationSec: 600,
    hint: "Keep enough proportional action for recovery, but avoid driving dampers end-to-end.",
    tutorial: "A step in IT load exposes whether SAT tuning has enough authority.",
    initialState: { outdoorDryBulb: 100, outdoorWetBulb: 63, itLoadKw: 420 },
    initialPID: { sat: { kp: 2.8, ki: 0.025, kd: 0, sp: 68, bias: 60 } },
    disturbances: [{ atSimTimeS: 220, target: "plant", property: "itLoadKw", value: 720, durationSec: 80, label: "IT load ramped up" }],
    criteria: { maxOvershootPct: 25, settlingTimeS: 280, maxRmse: 4, alarmLimit: 5 },
    scoringWeights: { settling: 0.3, overshoot: 0.2, rmse: 0.3, alarms: 0.2 },
    benchmarkTuning: { kp: 2.8, ki: 0.025, kd: 0 },
    benchmarkScore: 78
  },
  {
    id: "level2_integral_offset",
    level: 2,
    title: "Add Integral",
    subtitle: "Remove P-only offset",
    template: "directEvap",
    durationSec: 600,
    hint: "Add integral gently. Too much Ki makes delayed SAT loops hunt.",
    tutorial: "Integral action removes offset but must respect delay and saturation.",
    initialState: { outdoorDryBulb: 96, outdoorWetBulb: 63, itLoadKw: 520 },
    initialPID: { sat: { kp: 2.4, ki: 0.025, kd: 0, sp: 68, bias: 58 } },
    disturbances: [],
    criteria: { maxOvershootPct: 18, settlingTimeS: 260, maxRmse: 3, alarmLimit: 4 },
    scoringWeights: { settling: 0.25, overshoot: 0.25, rmse: 0.3, alarms: 0.2 },
    benchmarkTuning: { kp: 2.4, ki: 0.025, kd: 0 },
    benchmarkScore: 82
  },
  {
    id: "level2_wet_bulb_limit",
    level: 2,
    title: "Wet Bulb Limit",
    subtitle: "Humidity reduces evaporative authority",
    template: "directEvap",
    durationSec: 600,
    hint: "When wet bulb approaches dry bulb, more face damper may raise humidity without enough cooling.",
    tutorial: "High humidity can make direct evaporative cooling look like a tuning problem.",
    initialState: { outdoorDryBulb: 88, outdoorWetBulb: 82, itLoadKw: 520 },
    initialPID: { sat: { kp: 2.2, ki: 0.018, kd: 0, sp: 68, bias: 55 } },
    disturbances: [{ atSimTimeS: 260, target: "plant", property: "outdoorWetBulb", value: 85, durationSec: 90, label: "Wet bulb climbed" }],
    criteria: { maxOvershootPct: 22, settlingTimeS: 320, maxRmse: 5, alarmLimit: 8 },
    scoringWeights: { settling: 0.2, overshoot: 0.2, rmse: 0.3, alarms: 0.3 },
    benchmarkTuning: { kp: 2.2, ki: 0.018, kd: 0 },
    benchmarkScore: 74
  },
  {
    id: "level2_air_cooled_valve",
    level: 2,
    title: "Air-Cooled Coil",
    subtitle: "Tune chilled-water valve SAT control",
    template: "airCooled",
    durationSec: 540,
    hint: "The valve is reverse acting: a higher output means colder supply air.",
    tutorial: "The air-cooled template uses a simpler coil model but the same PID habits apply.",
    initialState: { itLoadKw: 480, roomTemp: 80, returnAirTemp: 80, chilledWaterSupplyTemp: 44 },
    initialPID: { sat: { kp: 2.6, ki: 0.03, kd: 0, sp: 56, bias: 55 } },
    disturbances: [{ atSimTimeS: 180, target: "plant", property: "itLoadKw", value: 680, label: "Compute row load added" }],
    criteria: { maxOvershootPct: 15, settlingTimeS: 240, maxRmse: 2.5, alarmLimit: 4 },
    scoringWeights: { settling: 0.25, overshoot: 0.25, rmse: 0.35, alarms: 0.15 },
    benchmarkTuning: { kp: 2.6, ki: 0.03, kd: 0 },
    benchmarkScore: 82
  },
  {
    id: "level3_derivative_filter",
    level: 3,
    title: "Derivative Filter",
    subtitle: "Calm noisy pressure response",
    template: "directEvap",
    durationSec: 520,
    hint: "Derivative is optional. If used, keep it on measurement and filtered.",
    tutorial: "Fast pressure loops expose derivative kick and actuator abuse quickly.",
    initialState: { outdoorDryBulb: 94, outdoorWetBulb: 70, itLoadKw: 550 },
    initialPID: { pressure: { kp: 32, ki: 0.45, kd: 0.6, derivOnMeas: true, derivN: 6, sp: 0.45, bias: 58 } },
    disturbances: [{ atSimTimeS: 240, target: "plant", property: "faceDamperActual", value: 35, label: "Dampers pinched airflow" }],
    criteria: { maxOvershootPct: 18, settlingTimeS: 220, maxRmse: 0.08, alarmLimit: 4 },
    scoringWeights: { settling: 0.25, overshoot: 0.2, rmse: 0.3, alarms: 0.15, actuator: 0.1 },
    benchmarkTuning: { kp: 32, ki: 0.45, kd: 0.6 },
    benchmarkScore: 80
  },
  {
    id: "level3_pad_fouling",
    level: 3,
    title: "Pad Fouling",
    subtitle: "Distinguish equipment fault from tuning",
    template: "directEvap",
    durationSec: 660,
    hint: "If output is high and SAT still drifts warm, check equipment status before adding more gain.",
    tutorial: "Fouled media reduces saturation efficiency and can mimic poor controller tuning.",
    initialState: { outdoorDryBulb: 98, outdoorWetBulb: 71, itLoadKw: 580, padFouling: 0.05 },
    initialPID: { sat: { kp: 2.8, ki: 0.025, kd: 0, sp: 68, bias: 60 } },
    disturbances: [{ atSimTimeS: 240, target: "plant", property: "padFouling", value: 0.38, durationSec: 120, label: "Evap media fouled" }],
    criteria: { maxOvershootPct: 20, settlingTimeS: 340, maxRmse: 5, alarmLimit: 8 },
    scoringWeights: { settling: 0.2, overshoot: 0.15, rmse: 0.3, alarms: 0.35 },
    benchmarkTuning: { kp: 2.8, ki: 0.025, kd: 0 },
    benchmarkScore: 76
  },
  {
    id: "level3_bypass_jam",
    level: 3,
    title: "Bypass Jam",
    subtitle: "Actuator fault blocks setpoint",
    template: "directEvap",
    durationSec: 640,
    hint: "A jammed bypass damper can keep hot air mixed in even when cooling demand is high.",
    tutorial: "Use diagnostics and equipment position to identify a mechanical limit.",
    initialState: { outdoorDryBulb: 97, outdoorWetBulb: 70, itLoadKw: 540 },
    initialPID: { sat: { kp: 2.8, ki: 0.025, kd: 0, sp: 67, bias: 60 } },
    disturbances: [
      { atSimTimeS: 180, target: "plant", property: "bypassDamperJammed", value: true, label: "Bypass damper jammed" },
      { atSimTimeS: 180, target: "plant", property: "bypassJamPosition", value: 55, label: "Bypass jammed half open" }
    ],
    criteria: { maxOvershootPct: 25, settlingTimeS: 360, maxRmse: 6, alarmLimit: 8 },
    scoringWeights: { settling: 0.15, overshoot: 0.15, rmse: 0.3, alarms: 0.4 },
    benchmarkTuning: { kp: 2.8, ki: 0.025, kd: 0 },
    benchmarkScore: 70
  },
  {
    id: "level3_economizer",
    level: 3,
    title: "Economizer Lockout",
    subtitle: "Use free cooling only when outdoor air helps",
    template: "directEvap",
    durationSec: 520,
    hint: "Economizer air helps at 55 deg F but should be locked out above warm thresholds.",
    tutorial: "Outdoor air is not always free cooling; lockout logic matters.",
    initialState: { outdoorDryBulb: 55, outdoorWetBulb: 48, itLoadKw: 500, econDamperActual: 35 },
    initialPID: { sat: { kp: 2.4, ki: 0.02, kd: 0, sp: 65, bias: 45 } },
    disturbances: [
      { atSimTimeS: 220, target: "plant", property: "outdoorDryBulb", value: 76, durationSec: 60, label: "Outdoor air warmed" },
      { atSimTimeS: 220, target: "plant", property: "outdoorWetBulb", value: 65, durationSec: 60, label: "Outdoor wet bulb warmed" }
    ],
    criteria: { maxOvershootPct: 25, settlingTimeS: 260, maxRmse: 4, alarmLimit: 6 },
    scoringWeights: { settling: 0.2, overshoot: 0.2, rmse: 0.25, alarms: 0.35 },
    benchmarkTuning: { kp: 2.4, ki: 0.02, kd: 0 },
    benchmarkScore: 78
  },
  {
    id: "level4_room_cascade",
    level: 4,
    title: "Room Cascade",
    subtitle: "Room loop drives SAT setpoint",
    template: "directEvap",
    durationSec: 720,
    hint: "Let the room loop move SAT setpoint slowly; the inner SAT loop should remain faster.",
    tutorial: "Cascade separates room thermal mass from the faster supply-air loop.",
    initialState: { outdoorDryBulb: 96, outdoorWetBulb: 71, itLoadKw: 620, roomTemp: 84, returnAirTemp: 84 },
    initialPID: {
      outer: { mode: "auto", kp: 2.2, ki: 0.02, kd: 0, sp: 80, bias: 68 },
      sat: { kp: 2.6, ki: 0.025, kd: 0, sp: 68, bias: 58 }
    },
    disturbances: [{ atSimTimeS: 280, target: "plant", property: "itLoadKw", value: 780, durationSec: 80, label: "Room load rose" }],
    criteria: { maxOvershootPct: 18, settlingTimeS: 420, maxRmse: 3.5, alarmLimit: 5 },
    scoringWeights: { settling: 0.3, overshoot: 0.2, rmse: 0.3, alarms: 0.2 },
    benchmarkTuning: { kp: 2.6, ki: 0.025, kd: 0 },
    benchmarkScore: 84
  },
  {
    id: "level4_feedforward",
    level: 4,
    title: "IT Load Feedforward",
    subtitle: "Preempt predictable load",
    template: "directEvap",
    durationSec: 650,
    hint: "Use feedforward lightly. It should reduce error before feedback catches up.",
    tutorial: "Feedforward is useful when IT load is measured before the room warms up.",
    initialState: { outdoorDryBulb: 95, outdoorWetBulb: 70, itLoadKw: 450 },
    initialPID: { sat: { kp: 2.2, ki: 0.02, kd: 0, sp: 68, bias: 56 } },
    disturbances: [{ atSimTimeS: 220, target: "plant", property: "itLoadKw", value: 850, durationSec: 40, label: "Scheduled compute burst" }],
    criteria: { maxOvershootPct: 16, settlingTimeS: 300, maxRmse: 3, alarmLimit: 4 },
    scoringWeights: { settling: 0.25, overshoot: 0.25, rmse: 0.35, alarms: 0.15 },
    benchmarkTuning: { kp: 2.2, ki: 0.02, kd: 0 },
    benchmarkScore: 86
  },
  {
    id: "level4_liquid_cdu",
    level: 4,
    title: "Liquid CDU Supply",
    subtitle: "Tune coolant supply temperature",
    template: "liquidCooled",
    durationSec: 620,
    hint: "The CDU supply loop is reverse acting: more cooling demand lowers supply temperature.",
    tutorial: "Liquid cooling has faster heat transfer but still has flow and bypass limits.",
    initialState: { itLoadKw: 700, rackInletTemp: 80, coolantInTemp: 60 },
    initialPID: { sat: { kp: 3.2, ki: 0.055, kd: 0, sp: 68, bias: 52 }, pressure: { sp: 18, bias: 60 } },
    disturbances: [{ atSimTimeS: 250, target: "plant", property: "itLoadKw", value: 980, durationSec: 60, label: "GPU rack load added" }],
    criteria: { maxOvershootPct: 16, settlingTimeS: 260, maxRmse: 2.5, alarmLimit: 4 },
    scoringWeights: { settling: 0.25, overshoot: 0.25, rmse: 0.35, alarms: 0.15 },
    benchmarkTuning: { kp: 3.2, ki: 0.055, kd: 0 },
    benchmarkScore: 84
  },
  {
    id: "level4_liquid_pressure",
    level: 4,
    title: "Pump Pressure Starvation",
    subtitle: "Hold secondary loop pressure",
    template: "liquidCooled",
    durationSec: 560,
    hint: "Low pressure can look like poor temperature tuning because heat transfer is starved.",
    tutorial: "Pressure control protects flow authority for the thermal loop.",
    initialState: { itLoadKw: 760, rackInletTemp: 80, pumpVFDActual: 45 },
    initialPID: { pressure: { kp: 1.8, ki: 0.08, kd: 0, sp: 18, bias: 58 } },
    disturbances: [{ atSimTimeS: 220, target: "plant", property: "bypassValveActual", value: 82, label: "Bypass valve opened" }],
    criteria: { maxOvershootPct: 18, settlingTimeS: 260, maxRmse: 2.8, alarmLimit: 5 },
    scoringWeights: { settling: 0.25, overshoot: 0.2, rmse: 0.3, alarms: 0.25 },
    benchmarkTuning: { kp: 1.8, ki: 0.08, kd: 0 },
    benchmarkScore: 82
  },
  {
    id: "level4_multi_fault",
    level: 4,
    title: "Expert Multi-Fault",
    subtitle: "Load, humidity, and actuator trouble",
    template: "directEvap",
    durationSec: 900,
    hint: "Use diagnostics to decide what is tunable and what is a plant fault.",
    tutorial: "Expert mode combines environmental and mechanical disturbances.",
    initialState: { outdoorDryBulb: 96, outdoorWetBulb: 70, itLoadKw: 580 },
    initialPID: { sat: { kp: 2.5, ki: 0.024, kd: 0, sp: 68, bias: 58 }, pressure: { sp: 0.45, bias: 58 } },
    disturbances: [
      { atSimTimeS: 180, target: "plant", property: "itLoadKw", value: 850, durationSec: 60, label: "IT load surge" },
      { atSimTimeS: 330, target: "plant", property: "outdoorWetBulb", value: 82, durationSec: 80, label: "Storm humidity arrived" },
      { atSimTimeS: 500, target: "plant", property: "padFouling", value: 0.35, durationSec: 90, label: "Pad fouling worsened" },
      { atSimTimeS: 620, target: "plant", property: "bypassDamperJammed", value: true, label: "Bypass linkage stuck" }
    ],
    criteria: { maxOvershootPct: 25, settlingTimeS: 440, maxRmse: 5.5, alarmLimit: 10 },
    scoringWeights: { settling: 0.2, overshoot: 0.15, rmse: 0.3, alarms: 0.25, actuator: 0.1 },
    benchmarkTuning: { kp: 2.5, ki: 0.024, kd: 0 },
    benchmarkScore: 88
  }
];

export function getHvacScenario(id?: string | null) {
  if (!id || id === "free") {
    return null;
  }
  return hvacScenarios.find((scenario) => scenario.id === id) ?? null;
}

type RampEvent = {
  event: HvacScenarioEvent;
  startedAt: number;
  from: number;
};

export class HvacScenarioEngine {
  active: HvacScenarioDefinition | null = null;
  private eventIndex = 0;
  private ramps: RampEvent[] = [];
  latestLabels: string[] = [];

  load(scenario: HvacScenarioDefinition | null) {
    this.active = scenario;
    this.eventIndex = 0;
    this.ramps = [];
    this.latestLabels = [];
  }

  tick({
    simTime,
    plant,
    pids,
    setRuntimeFlag
  }: {
    simTime: number;
    plant: { getSnapshot: () => HvacPlantSnapshot; applyState: (patch: Partial<HvacPlantSnapshot>) => void };
    pids: Record<HvacLoopId, { set: (patch: Partial<HvacPidConfig>) => void }>;
    setRuntimeFlag: (property: string, value: unknown) => void;
  }) {
    this.latestLabels = [];
    if (!this.active) {
      return;
    }

    while (
      this.eventIndex < this.active.disturbances.length &&
      this.active.disturbances[this.eventIndex].atSimTimeS <= simTime
    ) {
      const event = this.active.disturbances[this.eventIndex];
      this.eventIndex += 1;
      this.applyEvent(event, plant, pids, setRuntimeFlag, simTime);
      this.latestLabels.push(event.label);
    }

    const remaining: RampEvent[] = [];
    for (const ramp of this.ramps) {
      const duration = Math.max(ramp.event.durationSec ?? 0, 0.1);
      const progress = (simTime - ramp.startedAt) / duration;
      const current = lerp(ramp.from, Number(ramp.event.value), progress);
      plant.applyState({ [ramp.event.property]: current } as Partial<HvacPlantSnapshot>);
      if (progress < 1) {
        remaining.push(ramp);
      }
    }
    this.ramps = remaining;
  }

  private applyEvent(
    event: HvacScenarioEvent,
    plant: { getSnapshot: () => HvacPlantSnapshot; applyState: (patch: Partial<HvacPlantSnapshot>) => void },
    pids: Record<HvacLoopId, { set: (patch: Partial<HvacPidConfig>) => void }>,
    setRuntimeFlag: (property: string, value: unknown) => void,
    simTime: number
  ) {
    if (event.target === "pid" && event.loop) {
      pids[event.loop].set({ [event.property]: event.value } as Partial<HvacPidConfig>);
      return;
    }
    if (event.target === "runtime") {
      setRuntimeFlag(event.property, event.value);
      return;
    }
    if (typeof event.durationSec === "number" && event.durationSec > 0 && typeof event.value === "number") {
      const current = plant.getSnapshot()[event.property as keyof HvacPlantSnapshot];
      if (typeof current === "number") {
        this.ramps.push({ event, startedAt: simTime, from: current });
        return;
      }
    }
    plant.applyState({ [event.property]: event.value } as Partial<HvacPlantSnapshot>);
  }
}

export function getStoredHvacStage() {
  if (typeof window === "undefined") {
    return 1;
  }
  const value = Number(window.localStorage.getItem(HVAC_PROGRESS_KEY) ?? "1");
  return Number.isFinite(value) ? Math.max(1, Math.min(7, value)) : 1;
}

export function storeHvacStage(stage: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(HVAC_PROGRESS_KEY, String(Math.max(1, Math.min(7, Math.round(stage)))));
}
