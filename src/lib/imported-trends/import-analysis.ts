import {
  assessControlTrendStability,
  type ControlTrendSample,
  type ControlTrendStability
} from "@/lib/control-loop/stability";

export type ImportedCellValue = string | number | boolean | Date | null | undefined;
export type ImportedTrendRow = Record<string, ImportedCellValue>;

export type ImportedTrendRequiredField = "time" | "sp" | "pv" | "mv";
export type ImportedTrendParameterField = "kp" | "ti" | "td" | "pTerm" | "iTerm" | "dTerm";
export type ImportedTrendField =
  | ImportedTrendRequiredField
  | ImportedTrendParameterField
  | "outputMin"
  | "outputMax";

export type ImportedTrendColumnMapping = Partial<Record<ImportedTrendField, string>>;

export interface ImportedTrendSheet {
  name: string;
  columns: string[];
  rows: ImportedTrendRow[];
}

export interface ImportedTrendSample extends ControlTrendSample {
  rawIndex: number;
}

export interface ImportedTrendNormalizationOptions {
  pvSpan?: number | null;
  outputMin?: number;
  outputMax?: number;
  minimumSamples?: number;
}

export interface ImportedTrendNormalization {
  samples: ImportedTrendSample[];
  parameterTraces: Partial<Record<ImportedTrendParameterField, Array<{ x: number; y: number }>>>;
  missingRequiredFields: ImportedTrendRequiredField[];
  messages: string[];
  rejectedRowCount: number;
  validSampleCount: number;
  span: number;
  spanSource: "provided" | "inferred";
  outputMin: number;
  outputMax: number;
}

export interface ImportedTrendMetrics {
  currentError: number;
  pvRange: number;
  mvTravel: number;
  overshootPct: number;
  settlingTimeS: number | null;
  steadyStateError: number;
  iae: number;
  ise: number;
  itae: number;
  saturationPctOfRun: number;
  durationS: number;
  stability: ControlTrendStability;
}

export interface ImportedTrendAnalysis {
  normalized: ImportedTrendNormalization;
  metrics: ImportedTrendMetrics | null;
}

export const requiredImportFields: ImportedTrendRequiredField[] = ["time", "sp", "pv", "mv"];
export const optionalParameterFields: ImportedTrendParameterField[] = ["kp", "ti", "td", "pTerm", "iTerm", "dTerm"];

const fieldLabels: Record<ImportedTrendRequiredField, string> = {
  time: "time",
  sp: "setpoint",
  pv: "process variable",
  mv: "controller output"
};

const columnCandidates: Record<ImportedTrendField, string[]> = {
  time: [
    "time",
    "times",
    "timesec",
    "timesecs",
    "timesecond",
    "timeseconds",
    "seconds",
    "elapsed",
    "elapsedtime",
    "elapsedseconds",
    "timestamp",
    "datetime",
    "date",
    "sampletime"
  ],
  sp: ["sp", "setpoint", "setpoints", "setpt", "target", "targetvalue", "activesp", "loopsp"],
  pv: [
    "pv",
    "processvariable",
    "processvalue",
    "measuredvalue",
    "measurement",
    "feedback",
    "sensor",
    "loopinput",
    "activepv"
  ],
  mv: [
    "co",
    "mv",
    "output",
    "controlleroutput",
    "controloutput",
    "pidoutput",
    "manipulatedvariable",
    "command",
    "valvecommand",
    "dampercommand",
    "actuatorcommand",
    "activemv"
  ],
  kp: ["kp", "gain", "proportionalgain", "pg", "pbandgain"],
  ti: ["ti", "integraltime", "resettime", "reset", "ig", "ki"],
  td: ["td", "derivativetime", "rate", "dg", "kd"],
  pTerm: ["pterm", "p", "proportionalterm", "proportional"],
  iTerm: ["iterm", "i", "integralterm", "integral"],
  dTerm: ["dterm", "d", "derivativeterm", "derivative"],
  outputMin: ["outputmin", "comin", "mvmin", "minimumoutput", "lowlimit", "lowerlimit"],
  outputMax: ["outputmax", "comax", "mvmax", "maximumoutput", "highlimit", "upperlimit"]
};

export function parseCsvSheet(source: string, name = "CSV"): ImportedTrendSheet {
  const records = parseCsvRecords(source);
  const headerIndex = records.findIndex((row) => row.some((cell) => cell.trim() !== ""));
  if (headerIndex === -1) {
    return { name, columns: [], rows: [] };
  }

  const columns = makeUniqueColumns(records[headerIndex]);
  const rows = records
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((record) => rowFromRecord(columns, record));

  return { name, columns, rows };
}

export async function parseXlsxWorkbook(buffer: ArrayBuffer): Promise<ImportedTrendSheet[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  return workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const records = XLSX.utils.sheet_to_json<ImportedCellValue[]>(worksheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false
    }) as ImportedCellValue[][];
    return sheetFromRecords(name, records);
  });
}

export function autoMapImportedColumns(columns: string[]): ImportedTrendColumnMapping {
  const mapping: ImportedTrendColumnMapping = {};
  const used = new Set<string>();
  const fields: ImportedTrendField[] = [
    "time",
    "sp",
    "pv",
    "outputMin",
    "outputMax",
    "mv",
    "kp",
    "ti",
    "td",
    "pTerm",
    "iTerm",
    "dTerm"
  ];

  for (const field of fields) {
    const match = findBestColumn(field, columns, used);
    if (match) {
      mapping[field] = match;
      used.add(match);
    }
  }

  return mapping;
}

export function normalizeImportedTrendRows(
  rows: ImportedTrendRow[],
  mapping: ImportedTrendColumnMapping,
  options: ImportedTrendNormalizationOptions = {}
): ImportedTrendNormalization {
  const minimumSamples = options.minimumSamples ?? 20;
  const missingRequiredFields = requiredImportFields.filter((field) => !mapping[field]);
  const outputBounds = normalizeOutputBounds(options.outputMin ?? 0, options.outputMax ?? 100);
  const messages: string[] = [];

  if (missingRequiredFields.length) {
    messages.push(
      `Map ${missingRequiredFields.map((field) => fieldLabels[field]).join(", ")} before analyzing the trend.`
    );
    return emptyNormalization(missingRequiredFields, messages, outputBounds.min, outputBounds.max, options.pvSpan);
  }

  const timeColumn = mapping.time;
  const spColumn = mapping.sp;
  const pvColumn = mapping.pv;
  const mvColumn = mapping.mv;
  if (!timeColumn || !spColumn || !pvColumn || !mvColumn) {
    return emptyNormalization(missingRequiredFields, messages, outputBounds.min, outputBounds.max, options.pvSpan);
  }

  const candidates = rows.flatMap((row, index) => {
    const timeValue = parseTimeValue(row[timeColumn]);
    const sp = coerceNumber(row[spColumn]);
    const pv = coerceNumber(row[pvColumn]);
    const mv = coerceNumber(row[mvColumn]);

    if (!timeValue || sp === null || pv === null || mv === null) {
      return [];
    }

    return [{
      rawIndex: index,
      timeValue,
      sp,
      pv,
      mv,
      row
    }];
  });

  let rejectedRowCount = rows.length - candidates.length;
  const preferredTimeKind = candidates[0]?.timeValue.kind ?? "number";
  const consistentCandidates = candidates.filter((candidate) => candidate.timeValue.kind === preferredTimeKind);
  if (consistentCandidates.length !== candidates.length) {
    rejectedRowCount += candidates.length - consistentCandidates.length;
    messages.push("Rows with mixed numeric and timestamp time values were skipped.");
  }

  consistentCandidates.sort((left, right) => left.timeValue.value - right.timeValue.value);
  const firstTime = consistentCandidates[0]?.timeValue.value ?? 0;
  const firstTimeSeconds = timeValueToSeconds(firstTime, preferredTimeKind);
  const outputMinColumn = mapping.outputMin;
  const outputMaxColumn = mapping.outputMax;

  const samples: ImportedTrendSample[] = consistentCandidates.map((candidate) => {
    const timeSeconds = timeValueToSeconds(candidate.timeValue.value, preferredTimeKind) - firstTimeSeconds;
    const rowOutputBounds = normalizeOutputBounds(
      coerceNumber(outputMinColumn ? candidate.row[outputMinColumn] : null) ?? outputBounds.min,
      coerceNumber(outputMaxColumn ? candidate.row[outputMaxColumn] : null) ?? outputBounds.max
    );

    return {
      rawIndex: candidate.rawIndex,
      time: round(timeSeconds, 6),
      sp: candidate.sp,
      pv: candidate.pv,
      mv: candidate.mv,
      saturated: isSaturated(candidate.mv, rowOutputBounds.min, rowOutputBounds.max)
    };
  });

  const parameterTraces = buildParameterTraces(consistentCandidates, samples, mapping);
  const providedSpan = Number.isFinite(options.pvSpan) && (options.pvSpan ?? 0) > 0 ? Number(options.pvSpan) : null;
  const inferredSpan = inferPvSpan(samples);
  const span = providedSpan ?? inferredSpan;
  const spanSource = providedSpan === null ? "inferred" : "provided";

  if (spanSource === "inferred" && samples.length) {
    messages.push("PV span was inferred from the imported data. Enter the real instrument span for a stronger verdict.");
  }

  if (samples.length < minimumSamples) {
    messages.push(`Need at least ${minimumSamples} valid samples; ${samples.length} valid samples were found.`);
  }

  return {
    samples,
    parameterTraces,
    missingRequiredFields,
    messages,
    rejectedRowCount,
    validSampleCount: samples.length,
    span,
    spanSource,
    outputMin: outputBounds.min,
    outputMax: outputBounds.max
  };
}

export function analyzeImportedTrend(
  rows: ImportedTrendRow[],
  mapping: ImportedTrendColumnMapping,
  options: ImportedTrendNormalizationOptions = {}
): ImportedTrendAnalysis {
  const normalized = normalizeImportedTrendRows(rows, mapping, options);
  const minimumSamples = options.minimumSamples ?? 20;

  if (normalized.missingRequiredFields.length || normalized.samples.length < minimumSamples) {
    return { normalized, metrics: null };
  }

  const stability = assessControlTrendStability({
    samples: normalized.samples,
    span: normalized.span,
    minimumSamples
  });
  const latest = normalized.samples[normalized.samples.length - 1];
  const first = normalized.samples[0];
  const pvValues = normalized.samples.map((sample) => sample.pv);

  return {
    normalized,
    metrics: {
      currentError: latest.sp - latest.pv,
      pvRange: pvValues.length ? Math.max(...pvValues) - Math.min(...pvValues) : 0,
      mvTravel: sumTravel(normalized.samples, (sample) => sample.mv),
      overshootPct: stability.overshootPct,
      settlingTimeS: stability.settlingTimeS,
      steadyStateError: stability.steadyStateError,
      iae: integrateError(normalized.samples, (sample) => Math.abs(sample.sp - sample.pv)),
      ise: integrateError(normalized.samples, (sample) => (sample.sp - sample.pv) ** 2),
      itae: integrateError(normalized.samples, (sample) => sample.time * Math.abs(sample.sp - sample.pv)),
      saturationPctOfRun: stability.saturationPctOfRun,
      durationS: latest.time - first.time,
      stability
    }
  };
}

export function coerceNumber(value: ImportedCellValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = trimmed.replace(/%$/, "").replace(/,/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(numeric)) {
    return null;
  }

  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvRecords(source: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      if (next === "\n") {
        continue;
      }
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length || source.endsWith(",")) {
    row.push(field);
    records.push(row);
  }

  return records;
}

function sheetFromRecords(name: string, records: ImportedCellValue[][]): ImportedTrendSheet {
  const headerIndex = records.findIndex((row) => row.some((cell) => cellToString(cell).trim() !== ""));
  if (headerIndex === -1) {
    return { name, columns: [], rows: [] };
  }

  const columns = makeUniqueColumns(records[headerIndex].map(cellToString));
  const rows = records
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cellToString(cell).trim() !== ""))
    .map((record) => rowFromRecord(columns, record));

  return { name, columns, rows };
}

function rowFromRecord(columns: string[], record: ImportedCellValue[]): ImportedTrendRow {
  const row: ImportedTrendRow = {};
  columns.forEach((column, index) => {
    row[column] = record[index] ?? "";
  });
  return row;
}

function makeUniqueColumns(header: string[]) {
  const seen = new Map<string, number>();

  return header.map((value, index) => {
    const base = value.trim() || `Column ${index + 1}`;
    const key = base.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function cellToString(value: ImportedCellValue) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value === null || value === undefined ? "" : String(value);
}

function normalizeColumnName(column: string) {
  return column
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function findBestColumn(field: ImportedTrendField, columns: string[], used: Set<string>) {
  let best: { column: string; score: number } | null = null;

  for (const column of columns) {
    if (used.has(column)) {
      continue;
    }

    const score = scoreColumn(field, normalizeColumnName(column));
    if (score > (best?.score ?? 0)) {
      best = { column, score };
    }
  }

  return best && best.score >= 60 ? best.column : null;
}

function scoreColumn(field: ImportedTrendField, normalizedColumn: string) {
  if (!normalizedColumn) {
    return 0;
  }

  if (field === "mv" && /(min|max|limit|low|high)/.test(normalizedColumn)) {
    return 0;
  }

  const candidates = columnCandidates[field];
  if (candidates.includes(normalizedColumn)) {
    return 100;
  }

  const partial = candidates.find((candidate) => candidate.length > 2 && normalizedColumn.includes(candidate));
  if (partial) {
    return 75;
  }

  return 0;
}

function parseTimeValue(value: ImportedCellValue): { kind: "number" | "date"; value: number } | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? { kind: "date", value: time } : null;
  }

  const numeric = coerceNumber(value);
  if (numeric !== null) {
    return { kind: "number", value: numeric };
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? { kind: "date", value: parsed } : null;
}

function timeValueToSeconds(value: number, kind: "number" | "date") {
  if (kind === "date") {
    return value / 1000;
  }

  if (value > 946684800000) {
    return value / 1000;
  }

  return value;
}

function normalizeOutputBounds(outputMin: number, outputMax: number) {
  const min = Number.isFinite(outputMin) ? outputMin : 0;
  const max = Number.isFinite(outputMax) ? outputMax : 100;
  return {
    min: Math.min(min, max),
    max: Math.max(min, max)
  };
}

function isSaturated(mv: number, outputMin: number, outputMax: number) {
  const epsilon = Math.max(0.001, Math.abs(outputMax - outputMin) * 0.0001);
  return mv <= outputMin + epsilon || mv >= outputMax - epsilon;
}

function inferPvSpan(samples: ControlTrendSample[]) {
  if (!samples.length) {
    return 1;
  }

  const pvValues = samples.map((sample) => sample.pv);
  const pvRange = Math.max(...pvValues) - Math.min(...pvValues);
  const largestError = Math.max(...samples.map((sample) => Math.abs(sample.sp - sample.pv)), 0);
  return Math.max(pvRange, largestError, 1);
}

function emptyNormalization(
  missingRequiredFields: ImportedTrendRequiredField[],
  messages: string[],
  outputMin: number,
  outputMax: number,
  pvSpan?: number | null
): ImportedTrendNormalization {
  const span = Number.isFinite(pvSpan) && (pvSpan ?? 0) > 0 ? Number(pvSpan) : 1;
  return {
    samples: [],
    parameterTraces: {},
    missingRequiredFields,
    messages,
    rejectedRowCount: 0,
    validSampleCount: 0,
    span,
    spanSource: Number.isFinite(pvSpan) && (pvSpan ?? 0) > 0 ? "provided" : "inferred",
    outputMin,
    outputMax
  };
}

function buildParameterTraces(
  candidates: Array<{ row: ImportedTrendRow }>,
  samples: ImportedTrendSample[],
  mapping: ImportedTrendColumnMapping
) {
  const traces: Partial<Record<ImportedTrendParameterField, Array<{ x: number; y: number }>>> = {};

  for (const field of optionalParameterFields) {
    const column = mapping[field];
    if (!column) {
      continue;
    }

    const points = candidates.flatMap((candidate, index) => {
      const value = coerceNumber(candidate.row[column]);
      const sample = samples[index];
      return value === null || !sample ? [] : [{ x: sample.time, y: value }];
    });

    if (points.length) {
      traces[field] = points;
    }
  }

  return traces;
}

function integrateError(samples: ControlTrendSample[], selector: (sample: ControlTrendSample) => number) {
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const dt = Math.max(0, samples[index].time - samples[index - 1].time);
    total += selector(samples[index]) * dt;
  }
  return total;
}

function sumTravel(samples: ControlTrendSample[], selector: (sample: ControlTrendSample) => number) {
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    total += Math.abs(selector(samples[index]) - selector(samples[index - 1]));
  }
  return total;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
