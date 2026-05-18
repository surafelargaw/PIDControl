import type { HvacRuntimeView } from "@/lib/hvac/runtime";

export interface HvacFineTuneAdvice {
  title: string;
  detail: string;
}

function hasAlarm(view: HvacRuntimeView, id: string) {
  return view.alarms.some((alarm) => alarm.id === id && alarm.active);
}

function latestErrorMagnitude(view: HvacRuntimeView) {
  const latest = view.samples[view.samples.length - 1];
  return latest ? Math.abs(latest.error) : 0;
}

export function generateHvacFineTuneAdvice(view: HvacRuntimeView): HvacFineTuneAdvice[] {
  const advice: HvacFineTuneAdvice[] = [];
  const activeLoop = view.activeLoop;
  const activePid = view.pidStates[activeLoop];
  const activeResult = view.results[activeLoop];
  const plant = view.plant;
  const latestError = latestErrorMagnitude(view);
  const directEvapWetBulbLimited =
    plant.template === "directEvap" &&
    (plant.outdoorWetBulb >= 78 || plant.outdoorDryBulb - plant.outdoorWetBulb < 8);

  if (view.samples.length < 20) {
    return [
      {
        title: "Collect a little more trend",
        detail:
          "Let the loop run for a short period before judging tuning. The assistant needs enough SP, PV, and MV movement to separate tuning behavior from startup transients."
      }
    ];
  }

  if (activePid.mode === "manual") {
    advice.push({
      title: "Manual mode is holding the loop",
      detail:
        "The active PID is not correcting automatically. Use Manual to position the final element, then return to Auto and watch for a bumpless transfer before judging Kp, Ki, or Kd."
    });
  }

  if (plant.bypassDamperJammed || hasAlarm(view, "pad-fouling")) {
    advice.push({
      title: "Resolve equipment limits before retuning",
      detail:
        "A jammed bypass damper or fouled evaporative media can look like poor PID tuning. Confirm actuator and media status before adding gain or integral action."
    });
  }

  if (hasAlarm(view, "high-rh") || plant.supplyRH > 80 || directEvapWetBulbLimited) {
    advice.push({
      title: "Humidity is limiting direct evaporative authority",
      detail:
        "High supply RH means more face damper may add moisture without enough cooling. Treat wet-bulb conditions and bypass strategy as plant constraints, not only PID errors."
    });
  }

  if (activeResult.saturated || view.assessment.saturationSeconds > 20) {
    advice.push({
      title: "Check output authority and bias",
      detail:
        "The active loop is spending time at an output limit. Verify the final element has enough authority and the bias/manual output is reasonable before increasing integral action."
    });
  }

  if (view.assessment.overshootPct > 18) {
    advice.push({
      title: "Dampen overshoot",
      detail:
        "Overshoot is high for an HVAC training loop. Reduce Kp 10-25%, reduce Ki slightly, or add output rate limiting before trying a faster response."
    });
  }

  if ((view.assessment.settlingTimeS ?? 0) > 300 && view.assessment.overshootPct < 8 && latestError > 1) {
    advice.push({
      title: "Speed recovery carefully",
      detail:
        "The loop is calm but slow to recover. Increase Kp in small steps, then add a little Ki only if offset remains after the PV movement is stable."
    });
  }

  if (activeLoop === "pressure") {
    if (plant.fanVFDActual > 90 || hasAlarm(view, "high-pressure") || hasAlarm(view, "low-pressure")) {
      advice.push({
        title: "Treat fan pressure as the active final element",
        detail:
          "The pressure loop PV is static pressure, and its final element is the supply fan VFD. Tune this loop before blaming SAT if airflow authority is unstable or saturated."
      });
    } else {
      advice.push({
        title: "Pressure loop looks available",
        detail:
          "Static pressure is being controlled through fan speed. If SAT tuning still struggles, check face/bypass authority and wet-bulb conditions next."
      });
    }
  }

  if (activeLoop === "sat") {
    if (plant.template === "directEvap") {
      advice.push({
        title: "SAT PID drives face and bypass dampers",
        detail:
          "For direct evap, SAT PV is the controlled variable. OAT and WBT are disturbances; the PID output opens the face damper and inversely closes bypass."
      });
    } else if (plant.template === "airCooled") {
      advice.push({
        title: "SAT PID drives the chilled-water valve",
        detail:
          "For the air-cooled coil template, supply-air temperature is corrected through the valve. Keep pressure/fan control stable before judging the SAT loop."
      });
    } else {
      advice.push({
        title: "CDU supply loop drives bypass position",
        detail:
          "For liquid cooling, the SAT/primary loop uses CDU supply temperature as PV and moves the bypass valve inversely to cooling demand."
      });
    }
  }

  if (activePid.kd > 0 && Math.abs(activeResult.dTerm) > Math.max(8, Math.abs(activeResult.pTerm) * 0.8)) {
    advice.push({
      title: "Derivative is doing heavy work",
      detail:
        "Kd contribution is large compared with proportional action. HVAC loops usually prefer modest or no derivative unless the PV is clean and well filtered."
    });
  }

  if (view.cascadeEnabled && activeLoop !== "outer") {
    advice.push({
      title: "Cascade is moving the SAT setpoint",
      detail:
        "When cascade is enabled, the room loop trims the SAT setpoint. Tune the inner SAT loop first, then slow the room loop so it does not fight the faster loop."
    });
  }

  if (!advice.length) {
    advice.push({
      title: "Balanced operator run",
      detail:
        "The current HVAC exercise looks stable enough for operator practice. Save the tuning mentally as a baseline, then test a load, humidity, or actuator-fault scenario."
    });
  }

  return advice.slice(0, 5);
}
