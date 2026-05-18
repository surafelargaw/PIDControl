export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function moveToward(current: number, target: number, maxDelta: number) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return current + Math.sign(delta) * maxDelta;
}

export function average(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

export function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * clamp(amount, 0, 1);
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function gaussianNoise(stdDev: number) {
  if (stdDev <= 0) {
    return 0;
  }
  const u1 = Math.max(Math.random(), 0.000001);
  const u2 = Math.max(Math.random(), 0.000001);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev;
}

export function tempToHslColor(value: number, min = 55, max = 95) {
  const ratio = clamp((value - min) / Math.max(max - min, 1), 0, 1);
  const hue = 210 - ratio * 200;
  return `hsl(${hue.toFixed(0)} 82% 56%)`;
}
