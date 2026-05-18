export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function roundNumber(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

export function average(values: number[]) {
  if (!values.length) {
    return Number.NaN;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function sumTravel<T>(values: T[], selector: (value: T) => number) {
  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    total += Math.abs(selector(values[index]) - selector(values[index - 1]));
  }
  return total;
}

export function interpolateTimeAtValue(
  timeA: number,
  valueA: number,
  timeB: number,
  valueB: number,
  targetValue: number
) {
  if (Math.abs(valueB - valueA) < 0.0000001) {
    return timeB;
  }
  const ratio = (targetValue - valueA) / (valueB - valueA);
  return timeA + clamp(ratio, 0, 1) * (timeB - timeA);
}

export function slugify(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
