import { clamp } from "@/lib/hvac/utils";

export function fahrenheitToCelsius(value: number) {
  return (value - 32) / 1.8;
}

export function celsiusToFahrenheit(value: number) {
  return value * 1.8 + 32;
}

export function satPressureKpa(tempC: number) {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

export function humidityRatioFromDryWet(dryBulbF: number, wetBulbF: number) {
  const dryBulbC = fahrenheitToCelsius(dryBulbF);
  const wetBulbC = fahrenheitToCelsius(Math.min(wetBulbF, dryBulbF));
  const pwsWb = satPressureKpa(wetBulbC);
  const wsWb = (0.622 * pwsWb) / Math.max(101.325 - pwsWb, 0.001);
  const ratio = wsWb - 0.00066 * (1 + 0.00115 * wetBulbC) * (dryBulbC - wetBulbC);
  return clamp(ratio, 0, 0.04);
}

export function relativeHumidityFromDryWet(dryBulbF: number, wetBulbF: number) {
  return relativeHumidityFromDbW(dryBulbF, humidityRatioFromDryWet(dryBulbF, wetBulbF));
}

export function wetBulbFromDryBulbRh(dryBulbF: number, relativeHumidityPct: number) {
  const dryBulbC = fahrenheitToCelsius(dryBulbF);
  const rh = clamp(relativeHumidityPct, 1, 100);
  const wetBulbC =
    dryBulbC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(dryBulbC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) -
    4.686035;

  return Math.min(dryBulbF, celsiusToFahrenheit(wetBulbC));
}

export function satHumidityRatio(tempF: number) {
  const tempC = fahrenheitToCelsius(tempF);
  const pws = satPressureKpa(tempC);
  return clamp((0.622 * pws) / Math.max(101.325 - pws, 0.001), 0, 0.04);
}

export function relativeHumidityFromDbW(dryBulbF: number, humidityRatio: number) {
  const tempC = fahrenheitToCelsius(dryBulbF);
  const pws = satPressureKpa(tempC);
  const pw = humidityRatio * 101.325 / Math.max(0.622 + humidityRatio, 0.001);
  return clamp((pw / Math.max(pws, 0.001)) * 100, 0, 100);
}

export function dewPointF(_dryBulbF: number, humidityRatio: number) {
  const pwKpa = Math.max(humidityRatio * 101.325 / Math.max(0.622 + humidityRatio, 0.001), 0.0001);
  const alpha = Math.log(pwKpa / 0.6108);
  const dewPointC = (237.3 * alpha) / Math.max(17.27 - alpha, 0.001);
  return celsiusToFahrenheit(dewPointC);
}

export function enthalpyBtuPerLb(dryBulbF: number, humidityRatio: number) {
  return 0.24 * dryBulbF + humidityRatio * (1061 + 0.444 * dryBulbF);
}
