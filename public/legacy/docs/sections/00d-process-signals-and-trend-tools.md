# 0.4 Process, Signals, and Trend Tools

The `Settings` and `Advanced` tabs also include controls that act on the process side rather than the controller side. These controls help operators practice diagnosing problems caused by noise, disturbances, or actuator defects instead of assuming every problem is a tuning problem.

## Process And Valve Controls

| Control | What it changes | Technical reasoning | Training value |
| --- | --- | --- | --- |
| `Measurement Noise` | Adds random noise to the measured PV | Simulates sensor jitter and poor signal quality | Shows why noisy PV can make CO chatter |
| `Disturbance Profile` | Chooses the pattern of process upset | Adds load changes such as step, pulse, cyclic, or ramp disturbances | Shows disturbance rejection instead of only setpoint tracking |
| `Disturbance Intensity` | Scales the disturbance size | Increases the process upset without changing controller tuning | Helps compare mild versus severe load changes |
| `Show Valve Feedback` | Displays actuator feedback on the faceplate and trend | Separates controller command from actual valve position | Useful when teaching actuator lag or defects |
| `Valve Deadband` | Creates a no-response zone around small command changes | Simulates linkages or actuators that do not move for small commands | Explains why CO can move while valve position does not |
| `Stiction` | Resists motion until enough command change is present | Simulates sticking valves or dampers | Helps users recognize jumpy feedback and delayed response |
| `Positioner Overshoot` | Makes valve position overshoot a command change before settling | Simulates an overly aggressive positioner or actuator response | Shows why actuator dynamics can create loop oscillation |
| `Flow Characteristic` | Changes the output-to-flow relationship | Simulates `linear`, `equal percentage`, or `quick opening` response | Shows that process gain can change with valve position |

## Valve Cv And Flow Characteristics

Valve `Cv` describes how much flow a valve can pass for a given pressure drop. In the Lab, the `Flow Characteristic` control maps valve stroke or command position into an effective flow position before the process model sees it. The selected curve changes the apparent process gain even when the PID tuning numbers stay the same.

The three modeled characteristics are:

- `Linear`: equal valve-stroke changes produce equal modeled flow changes. A move from 20% to 30% has about the same flow effect as a move from 70% to 80%.
- `Equal Percentage`: small valve moves near closed produce small flow changes, while the same move near open produces a much larger flow change. This is common for control valves that need usable authority across a wide load range.
- `Quick Opening`: much of the flow appears early in the stroke, then the curve flattens near open. This can be useful for on/off or fast-opening service, but it can make a PID loop touchy near the low end.

This matters to PID response because the controller output is not the same thing as process effect. If the valve curve is gentle at the current operating point, the loop can look sluggish and the integral term may build up. If the curve is steep at the current operating point, the same `Kp` and `Ti` can suddenly feel aggressive, causing overshoot, cycling, or high valve travel. A tuning that behaves well around 40% valve position may not behave the same around 80%.

<!-- widget:valve-characteristic-demo -->

> Field Tip: When a loop behaves well at one load but hunts or stalls at another, compare the operating valve position with the valve characteristic and authority before blaming the PID constants alone.

## Advanced `4-20 mA` Signal Injection

The `Advanced` tab lets the user add live analog signals. These signals can override the setpoint, override the controller's measured PV, or add a disturbance load.

| Control | What it does | Technical reasoning | Training value |
| --- | --- | --- | --- |
| `Add Input` | Creates a new analog input row | Enables live external-signal style training without leaving the simulator | Useful for transmitter and controller-input exercises |
| `Enabled` | Turns a signal row on or off | Lets the user stage a signal without deleting it | Useful for before-and-after comparisons |
| `Target` | Maps the signal to `Setpoint`, `PV Measurement`, or `Disturbance` | Decides where the scaled signal enters the simulation | Shows the difference between changing demand, changing measurement, and changing load |
| `Raw Current` | Sets the signal current from `4` to `20 mA` | Simulates the raw instrument signal before scaling | Useful for calibration and signal-path training |
| `EU Min` / `EU Max` | Defines engineering-unit scaling | Converts raw current into the engineering value used by the simulator | Useful for transmitter-range discussions |
| `Remove` | Deletes the signal row | Frees the target for reuse | Useful when resetting an exercise |

![Standard 4-20 mA linear scaling from EU Min through midpoint to EU Max.](assets/help/analog-signal-scaling.svg)

### Analog Scaling Formula

The app scales analog input rows using the standard linear formula:

`Engineering Value = EU Min + ((mA - 4) / 16) x (EU Max - EU Min)`

That means:

- `4 mA` maps to `EU Min`
- `12 mA` maps to the midpoint
- `20 mA` maps to `EU Max`

### What Each Target Means

| Target | Where it enters the simulation | What it teaches |
| --- | --- | --- |
| `Setpoint` | Replaces the active controller target | Shows external demand changes such as a supervisory reset or operator command |
| `PV Measurement` | Replaces the measurement seen by the controller | Shows what happens when the controller believes the process is different from reality |
| `Disturbance` | Adds process load to the plant model | Shows upset recovery and disturbance rejection |

> Design Consideration: PV override training is especially useful because many field issues come from bad sensing, bad scaling, or bad wiring rather than from poor controller tuning.

## PV And Secondary PV In The PID Path

The primary `PV` is the controlled measurement used by the PID error calculation. In normal automatic operation, the loop path is:

`SP - PV = Error`

`Error -> PID calculation -> CO / MV -> final element -> process response -> PV`

That means the controller compares setpoint and `PV`, then calculates the controller output or manipulated variable. The final element could be a valve, damper, fan command, pump speed, or other actuator depending on the selected model.

![PV generation signal flow showing controller output, final element behavior, deadtime, process drive, lag model, actual PV, and measured feedback.](assets/help/pv-generation-signal-flow.svg)

### How The Simulator Generates PV

The simulator keeps separate values for actual process `PV`, measured `PV`, and filtered controller `PV`. Actual `PV` is the process response created by the plant model. Measured `PV` is actual `PV` after sensor noise, random upset, and measurement lag. Filtered `PV` is the value the PID calculation uses when the PV filter is enabled.

The simplified process response is:

`normalizedDrive = (characteristicPosition - baseOutput) / 100`

`drive = directionSign * gain * delayedDrive + disturbance + interactionEffect`

For a first-order process:

`state1[k+1] = state1[k] + (dt / lag1) * (drive[k] - state1[k])`

`PV[k+1] = clamp(initialPV + span * state1[k+1])`

For a second-order process:

`state1[k+1] = state1[k] + (dt / lag1) * (drive[k] - state1[k])`

`state2[k+1] = state2[k] + (dt / lag2) * (state1[k+1] - state2[k])`

`PV[k+1] = clamp(initialPV + span * state2[k+1])`

![PV lag model formulas showing first-order, second-order, integrating, and shared drive equations.](assets/help/pv-lag-model-formulas.svg)

`Secondary PV` is an intermediate or diagnostic process signal. It helps explain how the simulated plant is moving internally before or alongside the final controlled measurement. It is not the main stability verdict signal; the primary `PV` is.

In the main Lab, `Secondary PV` represents internal or coupled process movement before or alongside the final `PV`. In the Vendor PID Lab, `Secondary PV` represents the first lag or internal plant response before the final `PV`. Operators can use it to see whether the controller output is moving the internal process while the main `PV` is still delayed by process lag, measurement lag, or coupling.

## Trend Tools

The app includes two main trend panels and several tools to analyze them.

### Trend 1: `PV / CO / SP`

This chart shows:

- actual PV
- controller output
- setpoint
- filtered setpoint
- valve feedback when enabled

This is the best chart for answering questions such as:

- Did PV move in the correct direction?
- Did CO move too hard or not hard enough?
- Was valve feedback following command?
- Did the filtered SP soften the step?

### Trend 2: `P / I / D Contributions`

This chart shows the internal control terms:

- proportional contribution
- integral contribution
- derivative contribution
- total contribution

This chart is the best place to explain why CO moved. If CO changes and the user wants to know whether the change came from present error, accumulated error, or rate-of-change damping, this chart gives the answer.

## Cursor And Scale Controls

| Control | What it does | Why it matters |
| --- | --- | --- |
| `Cursor Count` | Chooses one or two active cursors | Lets the user compare one point or measure between two points |
| `Active Cursor` | Selects which cursor is placed next from the chart click | Makes point-by-point training easier |
| Chart click | Places the selected cursor on the trend | Allows quick event marking |
| Cursor drag | Moves an existing cursor | Allows precise measurement |
| `PV Min` / `PV Max` | Sets manual Y-scale for the main trend | Helps isolate a narrow band of process behavior |
| `Y Min` / `Y Max` | Sets manual Y-scale for the contribution trend | Helps isolate small term changes |
| `Auto` | Returns the chart to automatic scaling | Useful after manual zoom work |

![Trend cursor example showing cursors A and B with time and value deltas.](assets/help/trend-cursor-analysis.svg)

The cursor summary and cursor analysis cards report:

- cursor times
- PV and CO at each cursor
- delta time
- delta PV
- delta CO

These are useful for training topics such as rise time, settling time, overshoot interval, and disturbance recovery time.

## Metric Cards

The metric cards summarize the current run:

- `Current Error`
- `PV Span Seen`
- `CO Travel`
- `Valve Travel`

These are not replacements for detailed chart review. They are quick indicators that help explain:

- how far the loop is from target now
- how wide the response has been
- how hard the controller has worked
- how much the final element has actually moved

## CSV Export Use Cases

The CSV is especially useful when the simulator is part of formal training. Trainers can export data and ask users to:

- identify the peak PV
- estimate settling time
- compare CO travel before and after filtering
- explain whether a disturbance or a tuning change caused the visible improvement

![Valve defect illustration comparing controller command with delayed or jumpy valve feedback.](assets/help/valve-defects.svg)

> Field Tip: If the PV trend looks calm but the valve travel is high, the loop may be "stable" in appearance while still causing unnecessary actuator wear.
