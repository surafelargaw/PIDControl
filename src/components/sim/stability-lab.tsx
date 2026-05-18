import { TrendChart } from "@/components/sim/trend-chart";
import { StabilityBadge } from "@/components/sim/stability-badge";
import { createSimulationOptions, simulateForDuration } from "@/lib/sim/engine";
import { calculateRunMetrics } from "@/lib/sim/metrics";
import { getProcessModel } from "@/lib/sim/models";
import { generateFineTuneAdvice } from "@/lib/sim/tuning";

const scenarios = [
  {
    id: "good",
    title: "Good Stable",
    note: "Settled quickly with low overshoot and no sustained cycling.",
    controller: { kp: 2, ti: 90, td: 0 }
  },
  {
    id: "marginal",
    title: "Marginally Stable",
    note: "Overshoot is above the training target, but the response still decays.",
    controller: { kp: 1.2, ti: 32, td: 0.6 }
  },
  {
    id: "unstable",
    title: "Unstable",
    note: "Fails to settle and spends too much time at an output limit.",
    controller: { kp: 3.2, ti: 6, td: 0.1 }
  }
];

export function StabilityLab() {
  const model = getProcessModel("genericDoubleLag");
  const panels = scenarios.map((variant) => {
    const options = createSimulationOptions(model.id);
    options.controllerConfig = { ...options.controllerConfig, ...variant.controller };
    const runtime = simulateForDuration(model, options, 180);
    const metrics = calculateRunMetrics(runtime.history, model);

    return {
      ...variant,
      metrics,
      advice: generateFineTuneAdvice(model, options.controllerConfig, runtime.history, options.processOptions).slice(0, 2),
      series: [
        { label: "PV", color: "#5eead4", data: runtime.history.map((sample) => ({ x: sample.time, y: sample.pv })) },
        { label: "SP", color: "#f8fafc", data: runtime.history.map((sample) => ({ x: sample.time, y: sample.sp })), dashed: true }
      ]
    };
  });

  return (
    <main className="page-stack">
      <section className="page-card">
        <p className="eyebrow">Stability Lab</p>
        <h2>Side-By-Side Stable, Marginal, And Unstable Responses</h2>
        <p>
          This page gives operators the language the old app was missing: what “stable enough for the plant” looks like,
          what marginal cycling looks like, and what an unstable loop feels like before it hurts equipment.
        </p>
      </section>

      <section className="three-up">
        {panels.map((panel) => (
          <article key={panel.id} className="panel">
            <div className="chip-row">
              <div>
                <p className="eyebrow">{panel.title}</p>
                <h2>{panel.note}</h2>
              </div>
              <StabilityBadge status={panel.metrics.stability.status} />
            </div>

            <TrendChart title={panel.title} series={panel.series} />

            <div className="annotation-list">
              <div className="annotation">
                <h3>Operator Comment</h3>
                <p>
                  {panel.metrics.stability.status === "stable"
                    ? `Settled in ${panel.metrics.settlingTime?.toFixed(1) ?? "n/a"}s with ${panel.metrics.overshootPct.toFixed(1)}% overshoot.`
                    : panel.metrics.stability.status === "marginal"
                      ? "This is a yellow condition: the loop is controlled, but overshoot, offset, or settling margin needs attention."
                      : "This response is not safe to leave alone because PV is not settling and the output is working too hard."}
                </p>
              </div>
              <div className="annotation">
                <h3>Why It Matters</h3>
                <p>
                  {panel.metrics.stability.status === "stable"
                    ? "The PV returns near setpoint and stays there without excessive actuator work."
                    : panel.metrics.stability.status === "marginal"
                      ? "A marginal loop may look acceptable at a glance, but it leaves less room for disturbances and can create avoidable actuator movement."
                      : "An unstable loop can drive actuator wear, nuisance alarms, comfort loss, or process quality problems."}
                </p>
              </div>
              {panel.advice.map((item) => (
                <div key={item.title} className="annotation">
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
