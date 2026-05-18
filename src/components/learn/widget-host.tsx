"use client";

import { createPortal } from "react-dom";
import { WIDGET_REGISTRY, isLessonWidgetId } from "./widgets";

export type WidgetSlot = {
  slotId: string;
  widgetId: string;
  element: HTMLElement;
};

function UnknownWidget({ widgetId }: { widgetId: string }) {
  return (
    <section className="lesson-widget-card">
      <div className="chip-row">
        <div>
          <p className="eyebrow">Interactive Example</p>
          <h3>Widget unavailable</h3>
        </div>
        <span className="pill warning">Unknown widget</span>
      </div>
      <p className="lesson-widget-note">
        The lesson asked for <code>{widgetId}</code>, but no React widget is registered for that identifier.
      </p>
    </section>
  );
}

export function WidgetHost({ slots }: { slots: WidgetSlot[] }) {
  return (
    <>
      {slots.map((slot) => {
        const Widget = isLessonWidgetId(slot.widgetId) ? WIDGET_REGISTRY[slot.widgetId] : null;
        return createPortal(
          Widget ? <Widget /> : <UnknownWidget widgetId={slot.widgetId} />,
          slot.element,
          slot.slotId
        );
      })}
    </>
  );
}
