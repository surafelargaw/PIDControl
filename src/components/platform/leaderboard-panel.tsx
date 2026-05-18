"use client";

import { getScenarioAttempts } from "@/lib/platform/local-store";
import { scenarioRegistry } from "@/lib/platform/scenarios";

export function LeaderboardPanel() {
  const attempts = getScenarioAttempts()
    .slice()
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);

  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Leaderboard</p>
        <h2>Anonymous Scenario Rankings</h2>
        <p>Rankings are based on your local scenario attempts, sorted by score.</p>
      </section>

      {attempts.length ? (
        <section className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Scenario</th>
                <th>Score</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt, index) => (
                <tr key={`${attempt.scenarioId}-${attempt.createdAt}`}>
                  <td>{index + 1}</td>
                  <td>{scenarioRegistry.find((scenario) => scenario.id === attempt.scenarioId)?.title ?? attempt.scenarioId}</td>
                  <td>{attempt.score}</td>
                  <td>{attempt.passed ? "Passed" : "Failed"} / {attempt.stability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="empty-state">Run and score a scenario to populate the leaderboard.</div>
      )}
    </main>
  );
}
