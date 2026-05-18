import type { ComponentType } from "react";
import { BiasSliderDemo } from "./bias-slider-demo";
import { DataDrivenTuningWorkflow } from "./data-driven-tuning-workflow";
import { DeadbandValveDemo } from "./deadband-valve-demo";
import { DirectReverseDiagram } from "./direct-reverse-diagram";
import { PidResponseChart } from "./pid-response-chart";
import { PidTermExplorer } from "./pid-term-explorer";
import { ProcessTypeComparison } from "./process-type-comparison";
import { SetpointWeightingDemo } from "./setpoint-weighting-demo";
import { TuningMethodTimeline } from "./tuning-method-timeline";
import { ValveCharacteristicDemo } from "./valve-characteristic-demo";
import { WindupDemo } from "./windup-demo";

export type LessonWidgetId =
  | "pid-response-chart"
  | "pid-term-explorer"
  | "process-type-comparison"
  | "direct-reverse-diagram"
  | "windup-demo"
  | "deadband-valve-demo"
  | "bias-slider-demo"
  | "valve-characteristic-demo"
  | "tuning-method-timeline"
  | "data-driven-tuning-workflow"
  | "setpoint-weighting-demo";

export type LessonWidgetComponent = ComponentType;

export const WIDGET_REGISTRY: Record<LessonWidgetId, LessonWidgetComponent> = {
  "pid-response-chart": PidResponseChart,
  "pid-term-explorer": PidTermExplorer,
  "process-type-comparison": ProcessTypeComparison,
  "direct-reverse-diagram": DirectReverseDiagram,
  "windup-demo": WindupDemo,
  "deadband-valve-demo": DeadbandValveDemo,
  "bias-slider-demo": BiasSliderDemo,
  "valve-characteristic-demo": ValveCharacteristicDemo,
  "tuning-method-timeline": TuningMethodTimeline,
  "data-driven-tuning-workflow": DataDrivenTuningWorkflow,
  "setpoint-weighting-demo": SetpointWeightingDemo
};

export function isLessonWidgetId(value: string): value is LessonWidgetId {
  return Object.prototype.hasOwnProperty.call(WIDGET_REGISTRY, value);
}
