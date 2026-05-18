import type { StabilityStatus } from "@/lib/sim/types";

export function StabilityBadge({ status }: { status: StabilityStatus }) {
  const label = status === "stable" ? "Stable" : status === "marginal" ? "Marginal" : "Unstable";
  const className = status === "stable" ? "success" : status === "marginal" ? "warning" : "danger";

  return <span className={`pill ${className}`}>{label}</span>;
}
