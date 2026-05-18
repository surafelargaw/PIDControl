# 0.2 Faceplate and Operator Controls

The `Faceplate` tab is the operator-style control surface. It is intentionally designed to answer the same questions an operator asks in the field:

- What is the target?
- What is the process doing?
- What is the controller commanding?
- Is the actuator really following the command?
- Am I in `Auto` or `Manual`?

![Faceplate signal map showing SP, PV, CO, and valve feedback as one operating story.](assets/help/faceplate-signals.svg)

## Faceplate Reference

| Control or display | What it does in the app | Technical reasoning | Training note |
| --- | --- | --- | --- |
| `Auto` | Places the controller in automatic mode | In `Auto`, controller output is calculated from `Bias + P + I + D`, then limited by output limits | Use to show true closed-loop control behavior |
| `Manual` | Places the controller in manual mode | In `Manual`, the operator output directly drives CO and the PID calculation no longer determines output | Use to teach safe operator intervention and open-loop testing |
| `SP` readout | Displays the active setpoint seen on the trend | Shows the target that the controller is currently trying to satisfy | Watch this when testing setpoint steps or analog SP injection |
| `PV` readout | Displays the simulated process variable | Shows the actual process condition, not just the controller command | Use it to explain lag, overshoot, and settling |
| `CO` readout | Displays controller output percentage | Shows the command leaving the PID block or manual entry | Use it to explain why equipment movement can lead or lag PV response |
| `Valve FB` readout | Displays actuator feedback when enabled | Helps separate what the controller wants from what the actuator actually does | Important when deadband, stiction, or overshoot are active |
| Setpoint slider | Changes the operator-entered setpoint quickly | Good for step tests and visual demonstrations of loop response | Useful for fast training scenarios |
| `Exact Setpoint` | Changes SP with numeric precision | Useful when the operator wants an exact engineering value instead of a rough slider position | Good for repeatable exercises |
| `Units` | Displays the engineering units for the selected process model | Reinforces that a pressure loop and a temperature loop should not be interpreted the same way | Always check units before discussing magnitude |
| Manual output slider | Sets the operator output in `Manual` mode | Lets the user directly command the actuator without the PID math | Useful for explaining open-loop gain and direction |
| `Exact Manual Output` | Enters precise manual output numerically | Helpful for repeatable demonstrations and output-step tests | Use when comparing process gain at specific output levels |
| `Live Status` | Shows whether the run is paused or running and at what speed | Keeps the operator aware of execution state | Prevents confusion during training pauses |
| `Model Snapshot` | Summarizes the active model, direction, lag, deadtime, and general settings | Gives quick context without opening the full settings panel | Use before changing tuning so trainees know what process they are working on |

## Auto And Manual Mode

### Auto Mode

In `Auto`, the controller calculates CO from the loop conditions:

- the active setpoint
- the measured or overridden PV
- the selected PID form
- the current tuning values
- filters, limits, and controller direction

This is the mode used to teach closed-loop behavior.

### Manual Mode

In `Manual`, the controller does not move output from PID error. The operator-entered manual output becomes the active CO.

This is useful for:

- checking process direction
- stepping the actuator open or closed intentionally
- showing the difference between controller math and process response

> Commissioning Note: Manual mode is valuable for training, but it should also be used to teach caution. In real systems, manual output can drive valves and VFDs to positions that affect comfort, pressure, or equipment safety.

## What The Readouts Mean Together

The faceplate becomes much more useful when the four main values are read as one story:

- `SP` tells you what the controller wants
- `PV` tells you what the process is doing
- `CO` tells you how hard the controller is pushing
- `Valve FB` tells you whether the final element is following that command cleanly

If `CO` changes but `PV` does not, the issue may be process lag, low authority, saturation, or the wrong control direction.

If `CO` changes but `Valve FB` does not track well, the issue may be actuator defects such as deadband or stiction.

## Special Case: Advanced Setpoint Or PV Injection

When an advanced `4-20 mA` input is mapped to `Setpoint` or `PV`, the faceplate still remains useful, but the user should understand what is being shown.

- The live `SP` readout reflects the active setpoint being used by the simulation
- The setpoint slider and exact setpoint field continue to store the operator-entered fallback setpoint
- If PV injection is active, the controller may react to the injected measurement even when the true simulated PV is moving differently

This distinction is important in training because it separates:

- what the process really is
- what the controller believes it is

> Common Pitfall: Operators sometimes assume the controller is "wrong" when the real issue is that the controller is reacting to the measured PV presented to it. That is exactly why PV override training matters.
