"use client";

import { getScenarioAttempts } from "@/lib/platform/local-store";
import { scenarioRegistry } from "@/lib/platform/scenarios";

export function InstructorDashboard() {
  const attempts = getScenarioAttempts();

  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Instructor</p>
        <h2>Class Oversight Foundation</h2>
        <p>
          Attempt data is stored locally in the browser. Use this view to review pass rates and scenario coverage across
          your own sessions.
        </p>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <p className="eyebrow">Attempts</p>
          <h3>{attempts.length}</h3>
        </article>
        <article className="metric-card">
          <p className="eyebrow">Pass Rate</p>
          <h3>{attempts.length ? `${Math.round((attempts.filter((attempt) => attempt.passed).length / attempts.length) * 100)}%` : "n/a"}</h3>
        </article>
        <article className="metric-card">
          <p className="eyebrow">Tracked Scenarios</p>
          <h3>{scenarioRegistry.length}</h3>
        </article>
      </section>

      <section className="table-card">
        <p className="eyebrow">Scenario Heatmap</p>
        <h2>Where Trainees Are Struggling</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Attempts</th>
              <th>Passes</th>
              <th>Common Stability State</th>
            </tr>
          </thead>
          <tbody>
            {scenarioRegistry.map((scenario) => {
              const subset = attempts.filter((attempt) => attempt.scenarioId === scenario.id);
              const mostCommon = subset.length
                ? subset.sort((left, right) =>
                    subset.filter((attempt) => attempt.stability === right.stability).length -
                    subset.filter((attempt) => attempt.stability === left.stability).length
                  )[0]?.stability
                : "n/a";
              return (
                <tr key={scenario.id}>
                  <td>{scenario.title}</td>
                  <td>{subset.length}</td>
                  <td>{subset.filter((attempt) => attempt.passed).length}</td>
                  <td>{mostCommon}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
