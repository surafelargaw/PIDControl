# 3. Choosing the Right Controller: P vs PI vs PID vs PD

Most BAS loops use **PI control** because HVAC processes usually need both immediate correction and removal of steady-state offset, while also remaining tolerant of lag and field variability.

## General Selection Guidance

- **P only** is uncommon because it usually leaves a persistent offset unless bias or manual reset is continuously adjusted.
- **PI** is the default choice for most modulating HVAC loops, especially temperatures, pressures, and flows with moderate lag.
- **PID** is justified when the process is fast enough or overshoot-sensitive enough that derivative damping provides real value.
- **PD** is a niche option when offset is acceptable or handled elsewhere, but damping of a fast process is still useful.

> Design Consideration: Select the simplest controller that meets the process need. Complexity is not a substitute for good sensor placement, stable sequences, or proper actuator authority.

## Decision Table

| Process Type | Dynamics | Noise Sensitivity | Overshoot Risk | Actuator | Recommended Control Type | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Cooling coil discharge or supply temperature | Slow to moderate | Low to moderate | Moderate | Modulating valve | PI | Most common BAS use case. Integral should be added conservatively. |
| Heating coil temperature | Slow to moderate | Low | Moderate | Modulating valve | PI | Similar to cooling loops. Watch minimum flow and valve authority. |
| Duct static pressure | Fast | Moderate | Moderate to high | VFD | PI or PID | Start with PI. Add derivative only if fast changes and overshoot justify it. |
| Pump differential pressure | Moderate | Low | Moderate | VFD | PI | Usually stable with PI when sensor location and valve authority are sound. |
| Humidity control | Slow | High | Moderate | Modulating output | PI | Derivative is often avoided because sensor noise can dominate. |
| Staged enable trim loop | Slow and discrete | Low | Low | Staged equipment | P or PI with caution | Often better handled with deadband, staging logic, and delay than full PID. |
| Very fast pressure or flow trim | Fast | Moderate to high | High | VFD or fast actuator | PID or PD in select cases | Use only when the process and signal quality support it. |

## Why PI Is Usually Preferred

PI is usually robust enough for field conditions, easier to understand across vendors, and less vulnerable to noisy measurements than full PID.

## Why Pure P Is Rare

Pure proportional control may keep the system “near” setpoint, but that is often not enough for operational stability. A loop that is always a little off may interfere with reset logic, alarm thresholds, or downstream sequences.

> Field Tip: If a loop behaves acceptably with P only during startup, that does not mean the loop is complete. Revisit it once the process is stable and determine whether integral is needed to remove offset over normal operating cycles.
