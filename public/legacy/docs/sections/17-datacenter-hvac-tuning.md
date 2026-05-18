# 17. Datacenter HVAC PID Tuning — Equipment-Specific Guide

Datacenter HVAC loops operate under different constraints than comfort systems. IT load changes rapidly, cooling failure has immediate equipment consequences, and many loops must remain responsive 24 hours a day without the benefit of unoccupied setback periods. This section covers the three loop types most critical to datacenter thermal management: chiller pump differential pressure, cooling coil valve temperature, and fan duct static pressure.

---

## A. Chiller Pump Differential Pressure Control

### What This Loop Does

A variable-speed chilled water pump maintains a target differential pressure (DP) across the distribution system. The PID controls pump VFD speed as its output and measures system DP as its process variable. Maintaining correct DP ensures adequate flow is available to all cooling coils without over-pumping, which wastes energy and can cause valve authority problems.

### Process Characteristics

- **Response speed:** Fast. Pump speed changes affect DP within seconds. The loop has minimal dead time.
- **Nonlinearity:** Pump curves are nonlinear — the relationship between speed and DP changes significantly across the operating range. A gain that works well at 60% speed may be too aggressive at 90%.
- **Disturbances:** Sudden load changes (IT equipment power-up, cooling valve repositioning) cause step disturbances in DP. These are frequent and expected.

### Recommended Starting Parameters

| Parameter | Typical Starting Value | Notes |
|-----------|----------------------|-------|
| Kp (Proportional Gain) | 0.5 – 1.5 | Start moderate; pump curves are nonlinear |
| Ti (Integral Time) | 30 – 60 seconds | Slow enough to avoid windup during load surges |
| Td (Derivative) | 0 (disabled) | DP signal is typically clean; derivative rarely needed |
| Control Action | Direct Acting | Speed ↑ → DP ↑ |

### What Good Behavior Looks Like

- After a valve opens suddenly (load increase), DP drops momentarily then recovers smoothly within 15–30 seconds
- Pump speed changes are gradual — no rapid hunting
- At light load (few coils open), the pump does not slow to surge risk speeds; minimum speed constraint is respected

### Surge and Starvation Risk

Two failure modes are specific to pump loops:

**Pump surge:** The pump operates in an unstable region if speed drops below its minimum design point. The controller should have a minimum output limit (typically 20–30% of full speed) to prevent this. Verify this limit is active and that the integral term cannot wind down against it.

**Flow starvation:** If DP setpoint is set too low, some coils at the end of the distribution loop may not receive adequate flow. This produces a cooling shortfall that appears as a temperature control problem rather than a pump control problem. If cooling coil valve temperature loops are struggling despite being well-tuned, check whether DP is adequate.

### Load Range Testing

Evaluate the pump DP loop at multiple load points:

1. **Light load** (few coils open, low IT activity): verify pump stays above minimum speed and DP holds
2. **Moderate load** (typical operating condition): confirm smooth response to incremental valve movements
3. **High load** (multiple zones demanding simultaneously): confirm DP recovery after large step disturbance does not overshoot badly

---

## B. Cooling Coil Valve / Supply Air Temperature Control

### What This Loop Does

A chilled water valve on a cooling coil controls supply air temperature. The PID commands valve position (0–100%) as its output and measures supply air temperature as its process variable. This is typically a **reverse-acting** loop: opening the valve (increasing output) delivers more chilled water, which lowers supply air temperature.

### Process Characteristics

- **Response speed:** Slow. Thermal mass in the coil and the airstream means the PV responds to valve movement over tens of seconds to minutes, not seconds.
- **Dead time:** Present. There is a delay between when the valve moves and when the downstream temperature sensor registers the change.
- **Valve nonlinearity:** Equal-percentage valve trim (common on chilled water coils) means that the same valve position change has very different effects depending on where in the stroke the valve is. A move from 10% to 20% changes flow much less than a move from 80% to 90%.

### Recommended Starting Parameters

| Parameter | Typical Starting Value | Notes |
|-----------|----------------------|-------|
| Kp (Proportional Gain) | 1.0 – 3.0 | Higher than a fast loop can tolerate because slow thermal response absorbs proportional action |
| Ti (Integral Time) | 60 – 180 seconds | Should be roughly in the range of the thermal lag time constant |
| Td (Derivative) | 0 – small | Only if signal is clean and overshoot cannot be resolved otherwise |
| Control Action | Reverse Acting | Valve position ↑ → supply air temperature ↓ |

### Throttling Range and Valve Authority

The **throttling range** is the span of PV over which the controller expects to move the valve from minimum to maximum. Setting it correctly is critical:

- Too narrow: the valve reaches full open or full closed with small temperature deviations; output saturates frequently
- Too wide: the controller makes large valve movements for small temperature changes; response is sluggish

For a supply air temperature loop, the throttling range should reflect the realistic temperature differential between a fully open valve (maximum cooling) and the warmest acceptable supply condition at full load.

**Valve authority** (the fraction of total system pressure drop across the valve when fully open) should be at least 0.5. Poor authority flattens the equal-percentage curve and makes the loop behave as if it has excessive deadband in the lower valve positions.

### Anti-Windup and Freeze Protection

Two saturation scenarios require specific attention:

**Upper saturation (valve fully open):** The controller cannot deliver more cooling. The integral will wind up against this limit, causing significant overshoot when load eventually drops. Confirm anti-windup conditioning is active.

**Lower saturation and freeze risk:** In cold weather, stopping flow through a chilled water coil with warm outdoor air bypassing creates freeze risk. Most sequences include a minimum valve position (often 5–15%) during non-cooling periods. Verify the bias and output limits enforce this floor and that the integral cannot wind below it.

### What Good Behavior Looks Like

- A setpoint step change produces a smooth, slightly overdamped temperature response with ≤10% overshoot
- At steady state with constant IT load, the valve holds a stable position and temperature stays within ±1°F of setpoint
- During an IT load surge, temperature deviates briefly then recovers without hunting

---

## C. Fan VFD / Duct Static Pressure Control

### What This Loop Does

A variable-speed supply fan maintains a target duct static pressure. The PID controls fan VFD speed as its output and measures duct static pressure as its process variable. This is typically a **direct-acting** loop: increasing fan speed raises static pressure. Correct static pressure ensures terminal units receive adequate airflow without over-pressurizing the duct.

### Process Characteristics

- **Response speed:** Fast. Fan speed changes affect duct pressure within seconds.
- **Noise sensitivity:** Duct static pressure sensors see significant measurement noise from turbulence. This is one of the noisiest signals in a typical HVAC system.
- **Disturbances:** Sudden VAV box movements, damper openings, and equipment staging cause rapid pressure changes. These disturbances arrive faster than thermal loops can respond.
- **Multi-fan complexity:** Systems with multiple fans on the same duct present coupling challenges — one fan's speed affects the pressure seen by all others.

### Recommended Starting Parameters

| Parameter | Typical Starting Value | Notes |
|-----------|----------------------|-------|
| Kp (Proportional Gain) | 0.3 – 0.8 | Lower than other loop types; pressure responds very fast and noise is high |
| Ti (Integral Time) | 20 – 60 seconds | Should be close to the natural oscillation period observed during commissioning |
| Td (Derivative) | 0 (disabled) | Pressure signal noise makes derivative counterproductive in most installations |
| Control Action | Direct Acting | Fan speed ↑ → duct static pressure ↑ |

### Why Proportional Gain Must Be Low

The fast pressure response means that even modest proportional gain can produce rapid CO oscillation. The wide proportional band (low Kp) gives the fan room to settle before the next correction fires. Start at the low end of the range and increase only in small steps.

**Signature of Kp too high on a pressure loop:**
- Fan speed cycles rapidly (2–5 second period) even when disturbances are absent
- Pressure trend shows constant oscillation locked to fan speed changes
- The loop may appear "stable" on a 1-minute trend window but is clearly cycling on a 10-second view

### Integral Time and Oscillation Period

For duct static pressure loops, a useful heuristic is to set Ti approximately equal to the natural oscillation period observed at moderate gain. If the loop oscillates with a period of approximately 30 seconds before the integral is active, start Ti at 30–40 seconds. This avoids the integral adding to the oscillation frequency.

### PV Filtering for Pressure Loops

Because duct pressure sensors are inherently noisy, PV filtering is often essential rather than optional:

- Apply a first-order filter with a time constant of 2–5 seconds to the raw pressure signal before the PID sees it
- Confirm the filter does not introduce so much lag that the loop cannot respond to a genuine sudden pressure drop
- After filtering, view the filtered signal on a trend to verify that the noise floor is acceptably small

### Anti-Windup in Fan Loops

Fan loops are particularly susceptible to integral windup during duct startup sequences when VAV boxes are closed and pressure builds rapidly to maximum before any boxes open. Configure anti-windup limits to prevent the integral from winding up during this condition, or use a different control mode during startup.

### Multi-Fan Coordination

When multiple fans serve the same duct:

- Each fan should have identical tuning if they are truly parallel
- Verify that one fan's pressure response does not cause another's loop to oscillate through coupling
- Consider whether coordinated speed control (all fans driven to the same speed command) is more appropriate than independent loops for parallel installations

### What Good Behavior Looks Like

- After a sudden VAV box opening (load increase), pressure drops briefly then recovers within 10–20 seconds
- At steady state, fan speed holds within a few percent of its stable operating point
- The CO trend shows smooth, gradual adjustments — not rapid oscillation
- No sustained hunting even during peak IT load periods

---

## D. Cross-Loop Interactions

Datacenter HVAC loops do not operate in isolation. Understanding cross-loop dependencies prevents time spent tuning one loop while another is causing the symptom.

| If this loop is struggling... | Check this other loop first |
|------------------------------|----------------------------|
| Supply air temperature — too warm, valve fully open | Chilled water pump DP — may be too low, starving the coil |
| Fan pressure — oscillating, fan hunting | Chilled water valve — rapid valve movements change the thermal load on the airside, which can couple into the pressure loop |
| Chiller pump DP — oscillating | Multiple cooling valves — simultaneous rapid valve movements create a DP disturbance; check if valve loops are hunting |
| All cooling loops deteriorating over time | Fouled coils or filters — reduced heat transfer changes process gains for all downstream loops; mechanical cleaning before retuning |
