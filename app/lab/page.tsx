import { LabWorkspace } from "@/components/sim/lab-workspace";
import { getScenario } from "@/lib/platform/scenarios";

export default async function LabPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scenarioId = typeof params.scenario === "string" ? params.scenario : null;
  const scenario = getScenario(scenarioId);

  return <LabWorkspace scenario={scenario} />;
}
