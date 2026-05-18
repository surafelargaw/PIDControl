# 0.1 Toolbar and Run Controls

The top toolbar controls the overall simulation session. These controls do not tune the loop directly. They decide which process model is active, how fast the simulation runs, how much history is visible, and whether the current run should be paused, reset, restored, or exported.

![Workspace map highlighting the top toolbar as the control point for model selection, speed, pause, reset, and export.](assets/help/simulator-workspace-map.svg)

## Toolbar Reference

| Control | What it does in the app | Technical reasoning | Training use |
| --- | --- | --- | --- |
| `Simulator` | Shows the live simulator workspace | Returns the user to the interactive control surface | Use when discussing loop behavior from the charts and faceplate |
| `Help & Reference` | Opens the built-in documentation view | Separates learning material from live manipulation so the operator can switch between action and explanation | Use during instruction and refresher training |
| `Process Model` | Loads one of the built-in BAS process models | Replaces the active process metadata, engineering units, dynamic response, defaults, and controller direction | Use to compare temperature, pressure, flow, level, and humidity behavior |
| `Simulation Speed` | Runs the engine at `1x`, `2x`, `5x`, `10x`, or `30x` | The app uses a fixed internal sample time and advances more steps per screen update when speed is increased | Use `1x` for "plant-like" response and higher speed for quick comparisons |
| `X-Axis Timespan` | Changes the visible history window on the trend charts | Only changes the chart view window, not the underlying model state or stored samples | Use to zoom from a short transient to a longer settling period |
| `Pause` / `Resume` | Stops or restarts live advancement of the process | Freezes the simulation state so the current response can be inspected without more samples being added | Use when teaching steady-state, overshoot, or cursor measurements |
| `Reset PV/CO` | Rebuilds the live run using the current model and current settings | Clears runtime history and resets process and controller state while keeping the current tuning and options | Use when repeating the same test after changing only one setting |
| `Restore Model` | Restores the selected model to its original defaults | Reloads the default controller, process options, setpoint, scales, and advanced signals for that model | Use when starting a new training example from a known baseline |
| `Export CSV` | Downloads sampled simulation data | Exports time history for offline review, trending, or training handouts | Use after a comparison exercise or for Excel-based review |

## How Simulation Speed Works

![Training cycle showing how a run starts, is studied, reset, and repeated for comparisons.](assets/help/training-cycle.svg)

This app advances the process using a fixed internal time step of `0.1 s`. The toolbar speed selector changes how many internal steps are executed during each screen update.

- `1x` advances one simulation step per update and feels close to real time
- `2x` to `30x` advance multiple steps per update so the same control logic reaches steady state faster
- Faster speed changes do not make the controller smarter; they only reduce waiting time

That distinction matters in training. If a loop looks unstable at `1x`, it is not "fixed" by switching to `30x`. The instability is still present. The run is simply advancing faster.

## Reset Versus Restore

These two buttons are intentionally separate because they answer two different operator questions.

### `Reset PV/CO`

Use this when the user wants to run the same scenario again with the same current settings.

Examples:

- Repeat the same disturbance test after adjusting `Ti`
- Compare `PI` and `PID` using the same process options
- Restart a run after the charts become crowded

### `Restore Model`

Use this when the user wants to go back to the original training baseline for the selected model.

Examples:

- Remove advanced `4-20 mA` signal overrides
- Return valve defects to zero
- Return tuning values to the model's recommended defaults

> Design Consideration: Separating reset from restore is important in operator training because one action preserves the student's experimental setup while the other returns the simulator to a controlled baseline.

## What Happens During Export

The CSV export includes the live sampled values used by the simulator, including:

- time
- model identity
- controller mode and form
- PV, measured PV, filtered PV
- SP and filtered SP
- CO and valve position
- P, I, D, and total terms
- noise and disturbance values
- active advanced signal currents

This makes the export suitable for classroom exercises such as:

- calculating overshoot and settling time
- comparing `PI` versus `PID`
- discussing when a PV filter helped or hurt the response

> Field Tip: In training, export two runs with only one changed setting. Reviewing the CSV side by side is often the fastest way to make controller reasoning visible.
