# 14. Common Pitfalls and Cautions

| Pitfall | Why It Happens | Operational Risk | Better Response |
| --- | --- | --- | --- |
| Tuning before equipment is commissioned | The loop is asked to compensate for unresolved mechanical issues | Instability gets hidden instead of fixed | Verify sensors, flows, stroke, and authority first |
| Fighting resets during tuning | Another control layer is moving the target while tuning is being judged | False conclusions about gain quality | Freeze or understand resets during the tuning window |
| Wrong control direction | Label assumptions are made without a physical test | Immediate runaway or persistent instability | Confirm direction with a small controlled output change |
| Saturated actuators | Capacity, bias, limits, or minimums are not realistic | Windup, poor recovery, and bad trend interpretation | Solve limits and authority before gain changes |
| Trying to cure overshoot with hard output clamps alone | Output limiting looks easy and often gets added faster than the controller is understood | Slow recovery, strange offset, and hidden windup behavior | Prefer proper tuning, setpoint weighting, or feedforward before relying on clamps |
| Ignoring controller form or vendor math | Kp, Ti, and Td are copied between platforms as if they meant the same thing everywhere | A tune that looked good in software behaves badly in the BAS | Verify form, units, derivative source, and filtering before applying gains |
| Derivative used on noisy feedback | Sensor quality or sample rate does not support D action | Output chatter and unstable command behavior | Improve measurement quality or remove derivative |
| No safety limits or resonance checks on motion loops | Fast electromechanical systems can hit current, position, or structural limits quickly | Hardware damage or violent oscillation during tuning | Add limits first and check for resonance or sampling issues before raising gains |
| Over-tuning critical cooling loops | Pressure to "tighten" control leads to aggressive settings | Overshoot, nuisance alarms, reliability risk | Favor robust, damped response over speed |

## Additional Cautions

- Do not judge a slow loop too early
- Do not assume all BAS platforms implement integral and derivative the same way
- Do not assume a PI or PID loop is free from offset if anti-windup or internal output limits are active
- Do not confuse a calmer output with better process control unless PV quality also improved
- Do not forget filters, sample rate, or resonance when working on fast motion systems
- Do not leave undocumented tuning changes behind for operations to rediscover later

> Common Pitfall: A busy trend can tempt teams into constant retuning. Sometimes the right action is to stop tuning and investigate the process, the sequence, or the measurement path.

---

## Troubleshooting Guide: Datacenter HVAC Loops

Use this table when a loop is already in service and exhibiting a known symptom. Work through the "Check first" steps before adjusting gains.

For a broader branch-by-branch training guide, use `22. PID Tuning Troubleshooting Decision Tree`.

| Symptom | Likely Causes | Check First | Tuning Response |
| --- | --- | --- | --- |
| **Excessive oscillation / instability** | Kp too high; Ti too short; derivative amplifying noise; valve stiction causing limit cycling | Confirm control direction is correct; check for stiction with a manual output sweep; inspect sensor for noise spikes | Reduce Kp by 30-50%; lengthen Ti; if derivative is active and signal is noisy, remove Td first |
| **Steady-state error / persistent offset** | P-only control; Ti too long; output saturated at a limit; wrong bias | Confirm integral action is enabled; check whether output is hitting a limit; verify bias is not holding output away from what the process needs | Shorten Ti; if output is saturated, resolve capacity or authority issues before tuning |
| **Offset despite integral action** | Anti-windup or internal MV limits are interrupting the integrator during repeated disturbances | Compare the PID block's internal limit behavior with the real actuator limits; review how saturation is handled | Fix the saturation strategy before retuning; in some platforms, separating internal and external limits can preserve integral memory |
| **Slow response / sluggish recovery** | Kp too low; Ti too long; excessive filtering on PV; valve deadband absorbing small corrections; process lag is longer than assumed | Check PV filter time constant; manually step the output and measure actual process response time; verify valve responds to incremental changes | Increase Kp incrementally; shorten Ti; reduce PV filter if signal quality allows |
| **Noise sensitivity / chattering output** | Derivative on a noisy signal; PV filter too short; sensor near turbulent source; high-frequency process noise reaching the loop | View raw PV at high sample rate; confirm sensor placement; check PV filter and sample rate | Remove or reduce derivative; increase PV filter time constant; do not increase Kp to compensate for noise-driven instability |
| **Apparent tuning problem that is actually resonance or limits** | Mechanical resonance, inadequate sampling, or hard current or position limits in a fast loop | Check safety limits, oscillation frequency, filters, and actuator constraints before changing gains | Add notch or low-pass filtering where appropriate and back away from aggressive gains |
| **Apparent tuning problem that is not tuning** | Upstream process change; sequence conflict resetting SP or output; mechanical issue such as a fouled coil or stuck actuator | Trend the upstream drivers alongside the loop; check for overrides; verify actuator travel | Resolve the upstream or mechanical cause because retuning without fixing it will only mask the problem temporarily |
