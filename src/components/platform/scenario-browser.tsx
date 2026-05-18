import Link from "next/link";
import { scenarioRegistry } from "@/lib/platform/scenarios";

export function ScenarioBrowser() {
  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Scenarios</p>
        <h2>Structured Operator Exercises</h2>
        <p>
          These scenarios replace the old static exercise notes with data-backed objectives, pass criteria, hints, and
          scored outcomes.
        </p>
      </section>

      <section className="scenario-grid">
        {scenarioRegistry.map((scenario) => (
          <article key={scenario.id} className="scenario-card">
            <div className="chip-row">
              <span className="pill info">{scenario.difficulty}</span>
              <span className="pill info">{scenario.modelId}</span>
            </div>
            <h3>{scenario.title}</h3>
            <p>{scenario.objective}</p>
            <div className="annotation-list">
              <div className="annotation">
                <h3>Hints</h3>
                <p>{scenario.hints.join(" ")}</p>
              </div>
              <div className="annotation">
                <h3>Pass Criteria</h3>
                <p>
                  Stability {scenario.passCriteria.stabilityStatus ?? "any"} | Overshoot {"<="} {scenario.passCriteria.overshootPct ?? "n/a"}% |
                  Settle {"<="} {scenario.passCriteria.settlingTime ?? "n/a"}s
                </p>
              </div>
            </div>
            <Link href={`/lab?scenario=${scenario.id}`} className="button button-primary">
              Start Scenario
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
