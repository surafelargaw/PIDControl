# 19. Anti-Overshoot, Feedforward, and Bumpless Logic

This section is a decision guide for overshoot problems. The detailed explanations live in the canonical lessons listed below, so this page does not repeat them.

<!-- widget:setpoint-weighting-demo -->

## Start With The Symptom

| Symptom | First place to look | Canonical lesson |
| --- | --- | --- |
| Overshoot after a setpoint change | SP filtering, setpoint weighting, derivative source, and gain aggressiveness | `0.3 Controller Settings Explained` and `21. Vendor PID Controller Technical Background` |
| Overshoot after Manual-to-Auto or sequence handoff | Tracking, startup value, internal bias, and bumpless transfer | `9. Anti-Windup, Bumpless Transfer, and Mode Changes` |
| Overshoot after a measurable load change | Feedforward setup and disturbance measurement quality | `0.06 Controller Operating Modes` |
| Slow recovery after saturation | Output limits, actuator limits, and anti-windup behavior | `9. Anti-Windup, Bumpless Transfer, and Mode Changes` |
| A vendor loop behaves differently from the Lab loop | Proportional band versus gain, interval timing, setpoint weighting, and adaptive logic | `21. Vendor PID Controller Technical Background` |

## Anti-Overshoot Choices

Use these choices only after the basic loop direction, sensor quality, output limits, and actuator behavior are confirmed.

| Technique | Use when | Watch for |
| --- | --- | --- |
| Setpoint filtering | The setpoint moves faster than the process should reasonably follow | Too much filtering can make the loop feel lazy. |
| Setpoint weighting | Setpoint changes need a softer output kick but disturbance rejection still needs to stay firm | The exact meaning is vendor-specific. Check the vendor lesson before copying values. |
| Calmer proportional and integral tuning | The loop overshoots both setpoint changes and disturbances | Response may become slower. Validate with the stability checker. |
| Feedforward | A disturbance is measured before the PV reacts | Poor disturbance measurement can add the wrong correction. |
| Better bumpless logic | Output jumps during mode changes or staging handoffs | Startup values and tracking signals must match the real actuator path. |

## Where To Continue

- For feedforward mechanics, use `0.06 Controller Operating Modes`.
- For saturation, anti-windup, and bumpless transfer, use `9. Anti-Windup, Bumpless Transfer, and Mode Changes`.
- For vendor-specific setpoint weighting and startup values, use `21. Vendor PID Controller Technical Background`.
- For trend validation after any correction, use `0.05 Stability Checker & Metrics Explained`.

> Operator Rule: Overshoot is not always a request for less gain. Sometimes it is a mode-change, actuator, feedforward, or vendor-implementation problem.
