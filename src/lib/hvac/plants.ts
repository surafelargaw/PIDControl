import {
  humidityRatioFromDryWet,
  relativeHumidityFromDryWet,
  relativeHumidityFromDbW,
  satHumidityRatio
} from "@/lib/hvac/psychrometrics";
import type { HvacLoopId, HvacPlantCommands, HvacPlantModel, HvacPlantSnapshot, HvacTemplate } from "@/lib/hvac/types";
import { clamp, gaussianNoise, moveToward } from "@/lib/hvac/utils";

const baseSnapshot: HvacPlantSnapshot = {
  template: "directEvap",
  supplyAirTemp: 75,
  supplyAirTempPv: 75,
  supplyRH: 50,
  supplyHumidityRatio: 0.009,
  returnAirTemp: 85,
  roomTemp: 80,
  staticPressure: 0.5,
  staticPressurePv: 0.5,
  faceDamperActual: 80,
  bypassDamperActual: 0,
  fanVFDActual: 60,
  econDamperActual: 0,
  valveActual: 55,
  pumpVFDActual: 60,
  bypassValveActual: 45,
  rackInletTemp: 78,
  cduSupplyTemp: 68,
  cduSupplyTempPv: 68,
  secondaryPressure: 18,
  secondaryPressurePv: 18,
  outdoorDryBulb: 95,
  outdoorWetBulb: 62,
  outdoorRH: 30,
  itLoadKw: 500,
  padEffectiveness: 0.85,
  padFouling: 0,
  sensorBiasSat: 0,
  bypassDamperJammed: false,
  bypassJamPosition: 50,
  transportDelayS: 30,
  sensorTauS: 15,
  returnTauS: 60,
  coilEffectiveness: 0.82,
  chilledWaterSupplyTemp: 44,
  coolantInTemp: 60
};

abstract class BasePlant implements HvacPlantModel {
  protected state: HvacPlantSnapshot;
  protected supplyDelayBuffer: number[] = [];
  protected sensedSupplyAirTemp: number;
  protected sensedCduSupplyTemp: number;

  abstract readonly template: HvacTemplate;

  protected constructor(snapshot: Partial<HvacPlantSnapshot>) {
    this.state = { ...baseSnapshot, ...snapshot };
    this.sensedSupplyAirTemp = this.state.supplyAirTempPv;
    this.sensedCduSupplyTemp = this.state.cduSupplyTempPv;
  }

  applyState(patch: Partial<HvacPlantSnapshot>) {
    const previousDelay = this.state.transportDelayS;
    this.state = { ...this.state, ...patch };
    if (typeof patch.supplyAirTempPv === "number") {
      this.sensedSupplyAirTemp = patch.supplyAirTempPv;
    }
    if (typeof patch.cduSupplyTempPv === "number") {
      this.sensedCduSupplyTemp = patch.cduSupplyTempPv;
    }
    if (typeof patch.transportDelayS === "number" && patch.transportDelayS !== previousDelay) {
      this.supplyDelayBuffer = [];
    }
  }

  getSnapshot() {
    return { ...this.state, template: this.template };
  }

  getLoopPv(loopId: HvacLoopId) {
    if (loopId === "pressure") {
      return this.template === "liquidCooled" ? this.state.secondaryPressurePv : this.state.staticPressurePv;
    }
    if (loopId === "outer") {
      return this.template === "liquidCooled" ? this.state.rackInletTemp : this.state.roomTemp;
    }
    return this.template === "liquidCooled" ? this.state.cduSupplyTempPv : this.state.supplyAirTempPv;
  }

  abstract step(dtSeconds: number, commands: HvacPlantCommands): HvacPlantSnapshot;

  protected delayedSupply(value: number, dtSeconds: number) {
    const bufferSize = Math.max(1, Math.ceil(this.state.transportDelayS / Math.max(dtSeconds, 0.0001)));
    this.supplyDelayBuffer.push(value);
    if (this.supplyDelayBuffer.length > bufferSize) {
      return this.supplyDelayBuffer.shift() ?? value;
    }
    return value;
  }

  protected updateRoomThermal(dtSeconds: number, supplyTemp: number, fanVfd: number, maxCfm = 12000) {
    const cfm = fanVfd < 5 ? 0 : (fanVfd / 100) * maxCfm;
    const qCoolBtuHr = Math.max(0, 1.08 * cfm * (this.state.returnAirTemp - supplyTemp));
    const qItBtuHr = this.state.itLoadKw * 3412.14;
    const dRoomTemp = ((qItBtuHr - qCoolBtuHr) / 3600 / 50000) * dtSeconds;
    this.state.roomTemp = clamp(this.state.roomTemp + dRoomTemp, 45, 120);
    this.state.returnAirTemp += ((this.state.roomTemp - this.state.returnAirTemp) / this.state.returnTauS) * dtSeconds;
  }

  protected updateStaticPressure(dtSeconds: number, fanVfd: number, flowDemand: number, pressureNoise = 0.005) {
    const nNorm = fanVfd < 5 ? 0 : fanVfd / 100;
    const qNorm = clamp(flowDemand, 0, 2) * nNorm;
    const pFan = nNorm * nNorm * 1.0;
    const systemR = 0.45;
    this.state.staticPressure = clamp(pFan - systemR * qNorm * qNorm, 0, 2);
    this.state.staticPressurePv = clamp(this.state.staticPressure + gaussianNoise(pressureNoise), 0, 2);
    return dtSeconds;
  }
}

export class DirectEvapPlant extends BasePlant {
  readonly template = "directEvap" as const;

  constructor(snapshot: Partial<HvacPlantSnapshot> = {}) {
    super({ ...snapshot, template: "directEvap" });
  }

  step(dtSeconds: number, commands: HvacPlantCommands) {
    const primary = clamp(commands.primaryMv, 0, 100);
    const pressure = clamp(commands.pressureMv, 0, 100);
    this.state.faceDamperActual = moveToward(this.state.faceDamperActual, primary, 15 * dtSeconds);
    const bypassCommand = clamp(100 - primary, 0, 100);
    this.state.bypassDamperActual = this.state.bypassDamperJammed
      ? this.state.bypassJamPosition
      : moveToward(this.state.bypassDamperActual, bypassCommand, 15 * dtSeconds);
    this.state.fanVFDActual = moveToward(this.state.fanVFDActual, pressure, 25 * dtSeconds);
    this.state.econDamperActual = moveToward(
      this.state.econDamperActual,
      clamp(commands.econDamperCmd, 0, 100),
      10 * dtSeconds
    );

    const effectivePad = clamp(this.state.padEffectiveness * (1 - this.state.padFouling), 0, 1);
    const tEvap = this.state.outdoorDryBulb - effectivePad * (this.state.outdoorDryBulb - this.state.outdoorWetBulb);
    const faceF = this.state.faceDamperActual / 100;
    const bypassF = this.state.bypassDamperActual / 100;
    const totalF = faceF + bypassF + 0.000001;
    const tMixed = (faceF * tEvap + bypassF * this.state.outdoorDryBulb) / totalF;
    const econF = this.state.econDamperActual / 100;
    const tAfterEcon = econF > 0.01
      ? econF * this.state.outdoorDryBulb + (1 - econF) * this.state.returnAirTemp
      : tMixed;

    this.state.supplyAirTemp = this.delayedSupply(tAfterEcon, dtSeconds);
    this.sensedSupplyAirTemp +=
      ((this.state.supplyAirTemp - this.sensedSupplyAirTemp) / this.state.sensorTauS) * dtSeconds;
    this.state.supplyAirTempPv = this.sensedSupplyAirTemp + this.state.sensorBiasSat + gaussianNoise(0.08);

    const outdoorW = humidityRatioFromDryWet(this.state.outdoorDryBulb, this.state.outdoorWetBulb);
    this.state.outdoorRH = relativeHumidityFromDryWet(this.state.outdoorDryBulb, this.state.outdoorWetBulb);
    const faceW = outdoorW + effectivePad * (satHumidityRatio(tEvap) - outdoorW);
    const mixedW = clamp((faceF * faceW + bypassF * outdoorW) / totalF, 0, 0.04);
    this.state.supplyHumidityRatio = mixedW;
    this.state.supplyRH = relativeHumidityFromDbW(this.state.supplyAirTemp, mixedW);

    this.updateRoomThermal(dtSeconds, this.state.supplyAirTemp, this.state.fanVFDActual);
    this.updateStaticPressure(dtSeconds, this.state.fanVFDActual, totalF);
    return this.getSnapshot();
  }
}

export class AirCooledPlant extends BasePlant {
  readonly template = "airCooled" as const;

  constructor(snapshot: Partial<HvacPlantSnapshot> = {}) {
    super({
      template: "airCooled",
      supplyAirTemp: 62,
      supplyAirTempPv: 62,
      roomTemp: 80,
      returnAirTemp: 80,
      staticPressure: 0.45,
      staticPressurePv: 0.45,
      valveActual: 55,
      outdoorDryBulb: 90,
      outdoorWetBulb: 70,
      ...snapshot
    });
  }

  step(dtSeconds: number, commands: HvacPlantCommands) {
    this.state.valveActual = moveToward(this.state.valveActual, clamp(commands.primaryMv, 0, 100), 18 * dtSeconds);
    this.state.fanVFDActual = moveToward(this.state.fanVFDActual, clamp(commands.pressureMv, 0, 100), 25 * dtSeconds);
    const valvePct = this.state.valveActual / 100;
    const instantSupply =
      this.state.chilledWaterSupplyTemp +
      (1 - valvePct) * this.state.coilEffectiveness * (this.state.returnAirTemp - this.state.chilledWaterSupplyTemp);
    this.state.supplyAirTemp = this.delayedSupply(instantSupply, dtSeconds);
    this.sensedSupplyAirTemp +=
      ((this.state.supplyAirTemp - this.sensedSupplyAirTemp) / this.state.sensorTauS) * dtSeconds;
    this.state.supplyAirTempPv = this.sensedSupplyAirTemp + this.state.sensorBiasSat + gaussianNoise(0.06);
    this.state.supplyRH = relativeHumidityFromDbW(
      this.state.supplyAirTemp,
      humidityRatioFromDryWet(this.state.outdoorDryBulb, this.state.outdoorWetBulb) * 0.9
    );
    this.state.outdoorRH = relativeHumidityFromDryWet(this.state.outdoorDryBulb, this.state.outdoorWetBulb);
    this.updateRoomThermal(dtSeconds, this.state.supplyAirTemp, this.state.fanVFDActual);
    this.updateStaticPressure(dtSeconds, this.state.fanVFDActual, 0.8);
    return this.getSnapshot();
  }
}

export class LiquidCooledPlant extends BasePlant {
  readonly template = "liquidCooled" as const;

  constructor(snapshot: Partial<HvacPlantSnapshot> = {}) {
    super({
      template: "liquidCooled",
      cduSupplyTemp: 68,
      cduSupplyTempPv: 68,
      rackInletTemp: 78,
      roomTemp: 78,
      returnAirTemp: 82,
      secondaryPressure: 18,
      secondaryPressurePv: 18,
      pumpVFDActual: 60,
      bypassValveActual: 45,
      itLoadKw: 650,
      ...snapshot
    });
  }

  step(dtSeconds: number, commands: HvacPlantCommands) {
    const coolingDemand = clamp(commands.primaryMv, 0, 100);
    this.state.bypassValveActual = moveToward(this.state.bypassValveActual, 100 - coolingDemand, 20 * dtSeconds);
    this.state.pumpVFDActual = moveToward(this.state.pumpVFDActual, clamp(commands.pressureMv, 0, 100), 30 * dtSeconds);

    const pumpFlow = Math.max(this.state.pumpVFDActual / 100, 0.05);
    const bypassFrac = clamp(this.state.bypassValveActual / 100, 0, 1);
    const rackReturnTemp = this.state.rackInletTemp + clamp(this.state.itLoadKw / 650, 0.4, 2.2) * 10;
    const ntu = 1.4 * pumpFlow;
    const effectiveness = clamp(1 - Math.exp(-ntu), 0, 0.96);
    const cooledTemp = rackReturnTemp - effectiveness * (rackReturnTemp - this.state.coolantInTemp);
    this.state.cduSupplyTemp = bypassFrac * rackReturnTemp + (1 - bypassFrac) * cooledTemp;
    this.sensedCduSupplyTemp += ((this.state.cduSupplyTemp - this.sensedCduSupplyTemp) / 8) * dtSeconds;
    this.state.cduSupplyTempPv = this.sensedCduSupplyTemp + gaussianNoise(0.04);

    const coolingBtuHr = Math.max(0, (rackReturnTemp - this.state.cduSupplyTemp) * pumpFlow * 52000);
    const qItBtuHr = this.state.itLoadKw * 3412.14;
    this.state.rackInletTemp = clamp(
      this.state.rackInletTemp + ((qItBtuHr - coolingBtuHr) / 3600 / 42000) * dtSeconds,
      55,
      115
    );
    this.state.roomTemp = this.state.rackInletTemp;
    const pressure = (this.state.pumpVFDActual / 100) ** 2 * 42 - bypassFrac * 8;
    this.state.secondaryPressure = clamp(pressure, 0, 60);
    this.state.secondaryPressurePv = clamp(this.state.secondaryPressure + gaussianNoise(0.08), 0, 60);
    this.state.supplyAirTemp = this.state.cduSupplyTemp;
    this.state.supplyAirTempPv = this.state.cduSupplyTempPv;
    this.state.staticPressure = this.state.secondaryPressure;
    this.state.staticPressurePv = this.state.secondaryPressurePv;
    return this.getSnapshot();
  }
}

export function createHvacPlant(template: HvacTemplate, snapshot: Partial<HvacPlantSnapshot> = {}) {
  if (template === "airCooled") {
    return new AirCooledPlant(snapshot);
  }
  if (template === "liquidCooled") {
    return new LiquidCooledPlant(snapshot);
  }
  return new DirectEvapPlant(snapshot);
}
