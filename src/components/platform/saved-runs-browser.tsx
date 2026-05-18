"use client";

import { useEffect, useState } from "react";
import { deleteRun, getSavedRuns } from "@/lib/platform/local-store";
import { getProcessModel } from "@/lib/sim/models";

export function SavedRunsBrowser() {
  const [runs, setRuns] = useState(getSavedRuns());

  useEffect(() => {
    setRuns(getSavedRuns());
  }, []);

  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Saved Runs</p>
        <h2>Replay And Compare Tunings</h2>
        <p>Runs are stored locally in your browser. Export a run to CSV or PDF to share it.</p>
      </section>

      {runs.length ? (
        <section className="annotation-list">
          {runs.map((run) => (
            <article key={run.id} className="attempt-row">
              <div className="chip-row">
                <div>
                  <h3>{run.title}</h3>
                  <p>
                    {getProcessModel(run.modelId).name} | {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="chip-row">
                  <span className={`pill ${run.metrics.stability.status === "stable" ? "success" : run.metrics.stability.status === "marginal" ? "warning" : "danger"}`}>
                    {run.metrics.stability.status}
                  </span>
                  <button
                    className="button button-danger"
                    onClick={() => {
                      deleteRun(run.id);
                      setRuns(getSavedRuns());
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p>
                Overshoot {run.metrics.overshootPct.toFixed(1)}% | Settling {run.metrics.settlingTime?.toFixed(1) ?? "n/a"}s | IAE{" "}
                {run.metrics.iae.toFixed(2)}
              </p>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state">No saved runs yet. Save a run from the Lab page to build your tuning library.</div>
      )}
    </main>
  );
}
