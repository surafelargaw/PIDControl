# 12. Practical Field Tuning Workflow (Recommended)

This is the preferred field mindset for most BAS loops: change one thing at a time, wait for the process to respond, and judge the result from a trend rather than from a few seconds of faceplate movement.

## Recommended Workflow

1. Confirm the loop is commissionable: correct direction, believable sensor, stable actuator, and minimal sequence conflict.
2. Confirm the sign of process gain before tuning. A quick controlled output bump should tell you whether more output makes PV rise or fall.
3. Start with conservative control action, typically PI for most HVAC loops, but disable I and D during the first proportional pass.
4. Increase proportional response only until the loop reacts with useful authority but does not sustain oscillation.
5. Allow the process enough time to settle before deciding whether the change helped.
6. Add integral slowly to remove persistent offset after proportional action is doing most of the work.
7. Add derivative only if overshoot or damping still needs help and the PV signal is clean enough to support it.
8. Re-check output limits, deadband, bias, filters, and manual/auto behavior after tuning changes.
9. Trend the loop across more than one operating condition before calling it complete.

## What to Watch During Tuning

- Overshoot after a load change
- Repeating oscillation or hunting
- Slow recovery that still carries offset
- Output saturation at high or low limit
- Resets or safeties changing while the loop is being judged
- Whether setpoint response and disturbance recovery are both acceptable

## During Initial Tuning

- Lock out unnecessary reset changes if the process allows
- Avoid making multiple gain changes before the first one settles
- Keep notes on what was changed and what the loop actually did
- Record the controller form and units before comparing values from another platform or tuning package

## If Trend Data Is Available

When the platform can export clean trend data, use it:

- Save SP, PV, CV, and timestamps from a deliberate step or a representative disturbance
- Note when overrides, limits, or mode changes occurred so the dataset can be interpreted correctly
- Fit the simplest model that explains the trend before jumping to a more complex one
- Validate the recommended gains against the real controller options such as filters, setpoint weighting, and saturation handling

This can shorten tuning time dramatically on slow thermal loops, but only if the data window is clean and the controller implementation is matched correctly.

## Sensor Placement and Signal Quality

Tuning cannot compensate for a poorly placed or poorly conditioned sensor. Before adjusting any gain:

- **Temperature sensors:** Verify the sensor is in the airstream the controller is actually trying to control, not in a dead zone, a bypass path, or adjacent to a heat-generating surface. A sensor 6 inches in the wrong direction can make a well-tuned loop appear unstable.
- **Pressure sensors:** Confirm the tap location is not in a turbulent zone near an elbow, damper, or fan discharge. For duct static pressure, ASHRAE guidelines recommend locating the sensor at two-thirds of the duct length downstream of the fan.
- **Flow sensors:** Verify required straight-run distances upstream and downstream of the element are met. Short-run installations read high under turbulence and can cause the loop to underperform consistently.

## Derivative Caution

Derivative action amplifies the rate of change of the error signal. A sensor with any meaningful noise will cause derivative to produce large, rapid output swings that have nothing to do with process dynamics.

**Before enabling derivative:**
1. View the raw PV signal on a trend at high sample rate (1-second or faster if available)
2. Confirm the signal is smooth enough that rate-of-change is meaningful, not noise-driven
3. If noise is present, enable PV filtering first and re-evaluate before adding derivative
4. Start derivative at the smallest useful value and increase slowly; the output trend will show immediately if noise is being amplified

In datacenter HVAC, derivative is rarely needed for temperature or pressure loops and should be considered only for loops with fast, clean signals and significant overshoot that cannot be resolved by proportional and integral adjustment alone.

## Evaluating Results Across Operating Conditions

A tuning that looks good during a single commissioning session may not hold up across the full operating envelope.

**Recommended minimum evaluation conditions:**
- Test setpoint steps at both light load and heavy load conditions
- Observe behavior during occupied and unoccupied transitions if the system serves variable-occupancy spaces
- Run trends for at least several hours, not just a few minutes, before declaring a loop tuned
- For cooling loops in datacenter environments: specifically evaluate behavior when IT load ramps up or down sharply, as this is typically the most demanding disturbance scenario the loop will face in normal operation

> Field Tip: Many tuning mistakes come from impatience. Thermal loops especially can punish fast decision-making because the controller appears wrong before the process has had time to respond.

> Common Pitfall: If the output is saturated most of the time, tuning is not the first problem to solve. Review capacity, authority, bias, minimums, and sequence constraints first.
