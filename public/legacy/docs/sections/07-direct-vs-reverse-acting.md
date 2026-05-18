# 7. Direct-Acting vs Reverse-Acting Control

Control direction must match the physical effect of the actuator on the process. If direction is wrong, no amount of tuning will fix the loop.

## Practical HVAC View

- If increasing controller output makes the measured value go **up**, the loop is acting one way.
- If increasing controller output makes the measured value go **down**, the loop is acting the opposite way.

Examples:

- A fan speed command that increases duct static pressure is one direction.
- A chilled-water valve command that lowers supply air temperature is the opposite direction.

Because BAS naming conventions differ, the important check is always physical behavior, not the label alone.

<!-- widget:direct-reverse-diagram -->

## Decision Table

| Process Behavior | Controller Type |
|------------------|----------------|
| Output increase → PV increases | Direct Acting |
| Output increase → PV decreases | Reverse Acting |

**Datacenter HVAC examples:**

| Equipment | Output | PV | Type |
|-----------|--------|-----|------|
| Chilled water pump VFD | Speed % ↑ | Differential pressure ↑ | Direct Acting |
| Cooling coil valve (chilled water) | Valve position ↑ | Supply air temperature ↓ | Reverse Acting |
| Supply fan VFD | Speed % ↑ | Duct static pressure ↑ | Direct Acting |
| Heating valve | Valve position ↑ | Supply air temperature ↑ | Direct Acting |

## Consequences of Wrong Direction

Choosing the wrong action — direct instead of reverse or vice versa — means the loop drives the output in the exact opposite of what is needed. The controller sees error and increases output, which moves the PV further from setpoint, which increases error further. The result is:

- Immediate runaway from setpoint
- Output rapidly pinned at its limit
- No amount of gain tuning can stabilize a loop with the wrong direction set

> Datacenter Risk: A cooling valve loop with the wrong direction will drive the valve fully open attempting to cool when it should close, or fully closed when the space is overheating. Confirm direction before enabling Auto on any critical loop.

## Sanity Check Procedure Before Tuning

1. Place the loop in a safe and controlled test condition.
2. Apply a small, temporary output change.
3. Observe whether the measured process variable moves in the expected physical direction.
4. Confirm the displayed control action matches the real response.
5. Return to a stable baseline before making tuning changes.

## What Good Confirmation Looks Like

- Output up and PV moves in the expected direction
- Output down and PV reverses in the expected direction
- No unexpected interlocks or resets override the test
- Sensor feedback is believable and stable enough to interpret

> Field Tip: Confirm control direction before tuning, after major sequence edits, after sensor relocation, and after any actuator wiring or point-mapping change.

> Common Pitfall: Teams often assume direction from the graphic or from a familiar point name. Commissioning should confirm it from observed process behavior, not from assumption.
