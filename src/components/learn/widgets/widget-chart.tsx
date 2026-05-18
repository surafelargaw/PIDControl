"use client";

import { TrendChart } from "@/components/sim/trend-chart";
import type { WidgetSeries } from "./mini-sim";

export function WidgetChart({
  title,
  subtitle,
  series
}: {
  title: string;
  subtitle?: string;
  series: WidgetSeries[];
}) {
  return <TrendChart title={title} subtitle={subtitle} series={series} />;
}
