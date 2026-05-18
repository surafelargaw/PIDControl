import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/platform/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PID Trainer Platform",
    short_name: "PID Trainer",
    description: "Operator-focused PID training platform with simulator, scenarios, and instructor tooling.",
    start_url: "/",
    display: "standalone",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    icons: []
  };
}
