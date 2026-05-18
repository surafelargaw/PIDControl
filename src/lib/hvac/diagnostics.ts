import type { HvacAlarm, HvacDiagnosticMessage, HvacPidResult, HvacPlantSnapshot, HvacSample } from "@/lib/hvac/types";
import { average, standardDeviation } from "@/lib/hvac/utils";

function message(id: string, severity: HvacDiagnosticMessage["severity"], title: string, body: string): HvacDiagnosticMessage {
  return { id, severity, title, body };
}

export function analyzeHvacDiagnostics(
  samples: HvacSample[],
  plant: HvacPlantSnapshot,
  satState: { ki: number; outputMax: number; antiWindup: string },
  satResult: HvacPidResult
): HvacDiagnosticMessage[] {
  const recent = samples.slice(-120);
  if (recent.length < 8) {
    return [message("warming-up", "info", "Collecting trend", "Diagnostics will sharpen after more samples are recorded.")];
  }

  const messages: HvacDiagnosticMessage[] = [];
  const errors = recent.map((sample) => sample.error);
  const pvs = recent.map((sample) => sample.activePv);
  const meanError = average(errors);
  const stdError = standardDeviation(errors);
  const stdPv = standardDeviation(pvs.slice(-20));
  const latest = recent[recent.length - 1];
  const oldest = recent[0];

  let zeroCrossings = 0;
  for (let index = 1; index < recent.length; index += 1) {
    if (Math.sign(recent[index - 1].error) !== Math.sign(recent[index].error)) {
      zeroCrossings += 1;
    }
  }
  if (zeroCrossings >= 4) {
    messages.push(message("oscillation", "warning", "Loop is hunting", "Reduce Kp by 30-40% or add damping before increasing integral action."));
  }

  if (satResult.saturated && Math.abs(satResult.integral) > 180 && Math.abs(satResult.error) > 1) {
    messages.push(message("windup", "warning", "Integral windup risk", "Output is saturated while integral energy is high. Use clamp or back-calc anti-windup."));
  }

  if (satState.ki === 0 && Math.abs(meanError) > 1.5 && stdError < 0.75 && latest.simTime > 90) {
    messages.push(message("p-only-offset", "info", "P-only offset", "Steady-state offset is expected with proportional-only control. Add integral action when the stage allows it."));
  }

  const pvSlope = (latest.activePv - oldest.activePv) / Math.max(latest.simTime - oldest.simTime, 1);
  if (Math.abs(meanError) > 3 && Math.abs(pvSlope) < 0.01 && latest.simTime > 120) {
    messages.push(message("sluggish", "warning", "Slow recovery", "The loop is moving slowly relative to the error. Increase Kp or reduce integral time carefully."));
  }

  const maxMvStep = recent.slice(1).reduce((maxStep, sample, index) => {
    return Math.max(maxStep, Math.abs(sample.activeMv - recent[index].activeMv));
  }, 0);
  if (maxMvStep > 20) {
    messages.push(message("derivative-kick", "warning", "Large MV step", "A sharp output jump occurred. Keep derivative on measurement and verify rate limits."));
  }

  if (stdPv > 2 || Math.abs(latest.activePv - recent[Math.max(0, recent.length - 10)].activePv) > 5) {
    messages.push(message("sensor-fault", "error", "Possible sensor fault", "The PV trend has excessive noise or a step change not explained by setpoint movement."));
  }

  if (plant.supplyRH > 80) {
    messages.push(message("high-humidity", "warning", "High supply humidity", "Supply RH is approaching condensation risk. Increase bypass or reduce evaporative face flow."));
  }

  if (plant.transportDelayS / Math.max(plant.sensorTauS, 1) > 0.5) {
    messages.push(message("dead-time", "info", "Dead-time dominant", "The transport delay is large relative to sensor lag. Use lower gain and avoid aggressive integral."));
  }

  const mvVariation = recent.slice(1).reduce((total, sample, index) => total + Math.abs(sample.activeMv - recent[index].activeMv), 0);
  if (mvVariation > 55) {
    messages.push(message("actuator-abuse", "warning", "Excessive actuator movement", "The actuator is moving heavily. Reduce derivative, lower gain, or add output rate limiting."));
  }

  if (plant.outdoorDryBulb > 65 && plant.econDamperActual > 5) {
    messages.push(message("economizer-lockout", "warning", "Economizer lockout", "Outdoor air is above the free-cooling threshold while the economizer is open."));
  }

  if (plant.bypassDamperJammed && Math.abs(latest.error) > 3) {
    messages.push(message("bypass-jam", "error", "Bypass damper fault", "The bypass damper is jammed and may be preventing SAT from reaching setpoint."));
  }

  if (!messages.length) {
    messages.push(message("healthy", "success", "No major diagnostic findings", "The recent trend does not show hunting, windup, or obvious equipment faults."));
  }
  return messages;
}

export function evaluateHvacAlarms(
  plant: HvacPlantSnapshot,
  satResult: HvacPidResult,
  acknowledged: Set<string>
): HvacAlarm[] {
  const alarms: Array<Omit<HvacAlarm, "acknowledged"> & { condition: boolean }> = [
    {
      id: "high-sat",
      title: "High SAT",
      priority: "high",
      active: plant.supplyAirTempPv > 80,
      condition: plant.supplyAirTempPv > 80,
      detail: "Supply air temperature is above 80 deg F."
    },
    {
      id: "high-room",
      title: "High Room Temp",
      priority: "critical",
      active: plant.roomTemp > 85 || plant.rackInletTemp > 85,
      condition: plant.roomTemp > 85 || plant.rackInletTemp > 85,
      detail: "Room or rack inlet temperature is above 85 deg F."
    },
    {
      id: "high-rh",
      title: "High Supply RH",
      priority: "high",
      active: plant.supplyRH > 85,
      condition: plant.supplyRH > 85,
      detail: "Supply relative humidity is above 85%."
    },
    {
      id: "low-pressure",
      title: "Low Static Pressure",
      priority: "medium",
      active: plant.staticPressurePv < 0.2,
      condition: plant.staticPressurePv < 0.2,
      detail: "Static pressure is below 0.2 in. WC."
    },
    {
      id: "high-pressure",
      title: "High Static Pressure",
      priority: "medium",
      active: plant.staticPressurePv > 1.5,
      condition: plant.staticPressurePv > 1.5,
      detail: "Static pressure is above 1.5 in. WC."
    },
    {
      id: "integral-windup",
      title: "Integral Windup",
      priority: "info",
      active: satResult.saturated && Math.abs(satResult.integral) > 220,
      condition: satResult.saturated && Math.abs(satResult.integral) > 220,
      detail: "Controller output is saturated with high integral state."
    },
    {
      id: "pad-fouling",
      title: "Pad Fouling",
      priority: "medium",
      active: plant.padFouling > 0.3,
      condition: plant.padFouling > 0.3,
      detail: "Evaporative media fouling is above 30%."
    }
  ];

  return alarms
    .filter((alarm) => alarm.condition)
    .map(({ condition: _condition, ...alarm }) => ({
      ...alarm,
      acknowledged: acknowledged.has(alarm.id)
    }));
}
