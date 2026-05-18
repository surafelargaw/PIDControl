import type { SavedRunRecord, ScoredAttempt } from "@/lib/sim/types";

const KEYS = {
  savedRuns: "pid-platform.saved-runs",
  attempts: "pid-platform.scenario-attempts",
  role: "pid-platform.role"
} as const;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getSavedRuns() {
  return readJson<SavedRunRecord[]>(KEYS.savedRuns, []);
}

export function saveRun(record: SavedRunRecord) {
  const runs = getSavedRuns();
  writeJson(KEYS.savedRuns, [record, ...runs].slice(0, 50));
}

export function deleteRun(runId: string) {
  const runs = getSavedRuns().filter((run) => run.id !== runId);
  writeJson(KEYS.savedRuns, runs);
}

export function getScenarioAttempts() {
  return readJson<ScoredAttempt[]>(KEYS.attempts, []);
}

export function saveScenarioAttempt(attempt: ScoredAttempt) {
  const attempts = getScenarioAttempts();
  writeJson(KEYS.attempts, [attempt, ...attempts].slice(0, 200));
}

export function getStoredRole() {
  return readJson<string>(KEYS.role, "trainee");
}

export function setStoredRole(role: string) {
  writeJson(KEYS.role, role);
}
