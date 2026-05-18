# 1. Executive Summary

PID control is the backbone of modulating HVAC control in BAS and DDC systems. It allows a controller to compare a process variable to a target, apply corrective action through an actuator, and hold the process near the intended operating condition despite changing load, outdoor air, or equipment interaction.

In practical BAS work, PID tuning quality directly affects three outcomes:

- **Stability** of temperature, pressure, flow, and humidity loops
- **Energy performance** by reducing unnecessary actuator movement and reset chasing
- **Reliability** by limiting hunting, nuisance alarms, valve wear, and fan speed oscillation

This reference guide is written for three phases of work:

- **Design guidance** when selecting loop types, control direction, and expected loop behavior
- **Commissioning practice** when proving sensors, actuators, control logic, and tuning readiness
- **Operational optimization** when evaluating long-term trend behavior, seasonal drift, and retuning triggers

The guidance is intentionally non-vendor-specific. BAS platforms implement the same core concepts with different labels, units, and internal algorithms. The engineering objective remains the same: stable control that aligns with Sequence of Operations intent, supports safe Auto and Manual mode transitions, and remains understandable to field and operations teams.

> Design Consideration: Treat PID tuning as part of system design quality, not a last-minute startup activity. A loop can only be tuned well when sensors, actuators, sequences, and air or water balance support the intended control response.

## Where This Guide Applies

- Modulating valve control for cooling, heating, bypass, and trim loops
- Fan and pump VFD control based on pressure or flow feedback
- Differential pressure loops across coils, headers, or distribution systems
- Humidity and other slower loops where sensor quality and lag dominate behavior
- Any SOO-driven HVAC loop that must behave predictably during normal operation, reset conditions, and operator intervention

## Core Message

Well-tuned loops are typically calm, understandable, and repeatable. Poorly tuned loops often look busy long before they look obviously broken.

> Field Tip: When reviewing a trend, do not ask only whether the loop eventually reaches setpoint. Also ask how much actuator movement, overshoot, alarm exposure, and interaction with other resets were required to get there.
