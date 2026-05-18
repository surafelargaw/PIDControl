# 0. Help Overview

This help page is the operator and training reference for the PID Control Lab. It explains what each major control in the web app does, why the control exists technically, and what behavior to expect on the live trends when a setting is changed.

The goal is not only to tell the user which button to click. The goal is to explain the engineering reason behind each control so operators, technicians, and trainers can connect interface actions to loop behavior.

![Map of the simulator workspace showing the top toolbar, simulator sidebar, trend area, and help view.](assets/help/simulator-workspace-map.svg)

## Who This Help Page Is For

- Operators who need to understand what the loop is doing in `Auto` and `Manual`
- Technicians who want a fast explanation of `P`, `I`, `D`, filtering, limits, and disturbances
- Trainers who need a repeatable walkthrough for onboarding or refresher sessions
- Commissioning and optimization teams who want a safe training environment before making BAS changes

## How To Read The Simulator

| Area | Main purpose | Typical question it answers |
| --- | --- | --- |
| `Simulator` view | Run the process model and watch live response | "What happens if I change SP, tuning, or noise?" |
| `Help & Reference` view | Read control explanations and PID background | "What does this setting mean technically?" |
| `Faceplate` tab | Operate the loop like an operator station | "What are SP, PV, CO, and valve doing right now?" |
| `Settings` tab | Change tuning, filters, noise, disturbances, and valve behavior | "Why is the loop hunting, overshooting, or lagging?" |
| `Advanced` tab | Inject `4-20 mA` signals and analyze trends with cursors | "How does the controller react to a transmitter or disturbance input?" |
| `Process Model` selector | Loads a different simulated plant family | "Why does a pressure loop respond differently from a temperature or level loop?" |

## Key Signal Names Used In The App

| Signal | Meaning in the app | Why it matters |
| --- | --- | --- |
| `SP` | Setpoint | The target value the controller is trying to maintain |
| `PV` | Process Variable | The actual simulated process condition |
| `Measured PV` | The value seen by the controller before filtering, noise, or advanced input override is applied | Important when a PV override or noise is active |
| `CO` | Controller Output | The command sent by the PID block or manual operator entry |
| `Valve Feedback` | Simulated actuator position after defects such as deadband, stiction, and overshoot | Shows whether the actuator follows CO cleanly |
| `P Term` | Proportional contribution | Shows present-error response |
| `I Term` | Integral contribution | Shows accumulated correction over time |
| `D Term` | Derivative contribution | Shows rate-based damping response |
| `Total Term` | Sum of PID contributions before bias and limits | Helps explain why CO moved |

![Closed-loop control overview showing setpoint, PID controller, actuator, process, sensor, and feedback path.](assets/help/control-loop-overview.svg)

## Scope Of The Simulator

The simulator is designed for training and comparison. It helps users understand response direction, overshoot, settling, noise sensitivity, disturbance recovery, and valve-defect effects.

It is not intended to produce final field tuning values for a live BAS without engineering review.

> Commissioning Note: Use the simulator to train judgment, trend-reading skill, and terminology. Do not treat the displayed values as direct replacements for site-specific commissioning data.

## Recommended Training Path

1. Start with `0.1 Toolbar and Run Controls` so the trainee understands how to start, pause, reset, and export runs.
2. Move to `0.2 Faceplate and Operator Controls` to explain `Auto`, `Manual`, SP, PV, CO, and valve feedback.
3. Use `0.3 Controller Settings Explained` to cover the active controller fields, PID terms, filters, bias, and output limits.
4. Use `0.4 Process, Signals, and Trend Tools` to demonstrate noise, disturbances, valve defects, analog inputs, and cursor analysis.
5. Use `0.6 Process Model Library` so the trainee understands why different simulated plants respond differently.
6. Use `0.35 Standard Tuning Methods` when the trainee is ready to run Cohen-Coon, Ziegler-Nichols, Tyreus-Luyben, relay autotune, IMC/Lambda, or bump-test studies.
7. Finish with `0.5 Operator Training Exercises` and have the trainee explain what the trends mean in their own words.

## Canonical Topic Map

Some lessons include short reminders so a page can stand on its own. The deeper explanation should live in one canonical lesson so operators do not have to read the same material repeatedly.

| Topic | Canonical lesson | Notes |
| --- | --- | --- |
| App controls and faceplate readouts | `0.1`, `0.2`, `0.3`, and `0.4` | Use these for "what does this field do?" questions. |
| P, I, D, controller forms, filters, bias, and limits | `0.3 Controller Settings Explained` | Later lessons should link back here instead of re-explaining the control card. |
| Operating structures: Single, Feedforward, Cascade, Interacting | `0.06 Controller Operating Modes` | Feedforward belongs here; advanced lessons should only reference it. |
| Standard tuning studies in the Lab | `0.35 Standard Tuning Methods` | This is the home for Cohen-Coon, Ziegler-Nichols, Tyreus-Luyben, relay autotune, IMC/Lambda, and bump test details. |
| Data-driven tuning outside the built-in studies | `18. Data-Driven and Model-Based PID Tuning` | Use this when exported trend data or external tuning software is the main subject. |
| Anti-windup, saturation, and bumpless mode changes | `9. Anti-Windup, Bumpless Transfer, and Mode Changes` | Overshoot lessons should point here for mode-change and saturation logic. |
| Vendor-specific terminology and controller behavior | `21. Vendor PID Controller Technical Background` | Use this when comparing Siemens, Honeywell, ALC, and JCI terms. |
| Field troubleshooting by trend symptom | `22. PID Tuning Troubleshooting Decision Tree` | Use this when a live loop is oscillating, overshooting, sluggish, noisy, offset, or saturated. |

![Training cycle showing model selection, tuning study, apply tuning, watch trends, debrief, and repeat.](assets/help/training-cycle.svg)

## What The App Is Actually Doing

At every simulation step, the app updates the filtered setpoint, the measured PV, the PID terms, the controller output, the valve position, and the process state. That means every visible trend is tied to a live calculation, not a static drawing.

The selected process model is a major part of that calculation. It determines:

- engineering units and display range
- direct versus reverse process response
- process gain and sensitivity
- deadtime and lag structure
- whether the plant is self-regulating or integrating
- default controller values and default operating conditions

This is why the help topics focus on both interface behavior and control reasoning. A user should understand not only that a control changes a number, but also whether it changes the controller input, the controller math, the actuator, or the process model itself.

> Field Tip: During training, ask two questions after every change: "What changed in the math?" and "What changed on the trend?" That keeps the conversation grounded in cause and effect.
