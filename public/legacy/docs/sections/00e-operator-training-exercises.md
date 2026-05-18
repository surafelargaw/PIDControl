# 0.5 Operator Training Exercises

This section turns the simulator into a structured training tool. Each exercise is designed to connect a control change to a visible trend change and to force the trainee to explain the reason in plain language.

![Training cycle showing the recommended loop of choose model, run study, apply tuning, watch trends, and debrief.](assets/help/training-cycle.svg)

## Exercise 1: Basic Setpoint Step

### Goal

Teach the difference between `SP`, `PV`, and `CO`.

### Steps

1. Choose a simple model such as `Generic Deadtime + Single Lag`.
2. Leave the controller in `PI`.
3. Start with default settings.
4. Change the setpoint by a clear step using the faceplate slider.
5. Watch the main trend until the process settles.

### What To Ask

- Which signal moved first?
- Did CO move before PV?
- Was there deadtime before PV reacted?
- Did PV overshoot the new SP?

### Why It Matters

This teaches the most basic closed-loop story: target changes first, controller output responds second, process response comes after process lag and deadtime.

## Exercise 2: P Versus PI Versus PID

### Goal

Teach what each controller mode contributes.

### Steps

1. Run the same model three times.
2. First use `P`, then `PI`, then `PID`.
3. Keep the same SP step size.
4. Use `Reset PV/CO` between each run.

### What To Ask

- Which mode left steady-state offset?
- Which mode removed offset?
- Which mode reduced overshoot most effectively?
- Which mode produced the smoothest or noisiest CO?

### Why It Matters

Operators learn that:

- `P` alone often leaves offset
- `PI` is usually the practical HVAC default
- `PID` may help but only when process dynamics and measurement quality support it

## Exercise 3: Noise And PV Filtering

### Goal

Show why a noisy PV can make a loop look unstable even when the process is not the root problem.

### Steps

1. Choose a faster loop such as `Fan Static Pressure` or `Gas / Duct Pressure`.
2. Increase `Measurement Noise`.
3. Observe PV and CO with `PV Filter` off.
4. Turn `PV Filter` on and gradually increase filter time.

### What To Ask

- Did PV become calmer?
- Did CO stop chattering?
- Did the loop feel slower after filtering?
- Was the tradeoff worth it?

### Why It Matters

This exercise teaches that filtering can reduce noise-driven output movement, but too much filtering can also add lag and slow real disturbance recovery.

## Exercise 4: Disturbance Rejection

### Goal

Teach the difference between following a setpoint and rejecting a load disturbance.

### Steps

1. Choose a loop with visible dynamics such as `Cooling Coil Temperature` or `Pump Differential Pressure`.
2. Keep SP fixed.
3. Select a disturbance profile such as `Step load` or `Pulse load`.
4. Increase `Disturbance Intensity`.
5. Run the simulation and watch how the loop recovers.

### What To Ask

- Did PV leave setpoint because SP changed or because load changed?
- How quickly did CO respond?
- Did integral action remove the remaining offset?
- Did the loop recover smoothly or oscillate?

### Why It Matters

Many real systems operate with a nearly fixed SP and changing load. Disturbance rejection is often more important than setpoint tracking.

## Exercise 5: Valve Defect Recognition

### Goal

Teach how mechanical problems can look like tuning problems.

### Steps

1. Enable `Show Valve Feedback`.
2. Add `Valve Deadband`, then `Stiction`, then `Positioner Overshoot` one at a time.
3. Repeat the same SP step for each condition.
4. Compare `CO` to `Valve Feedback`.

### What To Ask

- Did the valve follow small CO changes?
- Did feedback jump after sticking?
- Did overshoot in valve feedback create extra PV movement?
- Would retuning alone fix the issue?

### Why It Matters

This exercise teaches operators not to blame the PID block for every unstable trend. Sometimes the controller is correct and the final control element is the real problem.

## Exercise 6: `4-20 mA` Signal Training

### Goal

Teach signal scaling and the difference between setpoint, PV, and disturbance inputs.

### Steps

1. Open the `Advanced` tab.
2. Add an input and map it to `Setpoint`.
3. Confirm that `4 mA`, `12 mA`, and `20 mA` map to `EU Min`, midpoint, and `EU Max`.
4. Repeat with `PV Measurement` and then with `Disturbance`.

### What To Ask

- Which target changed the controller target?
- Which target changed what the controller believed?
- Which target changed the process load directly?
- Why are those three cases not the same?

### Why It Matters

This exercise builds operator understanding of transmitter scaling, supervisory reset, bad measurement input, and process upset behavior.

## Suggested Debrief Questions

After any exercise, ask the trainee to answer these five questions:

1. What changed first on the trend?
2. Which PID term was most responsible?
3. Did the actuator follow the controller command cleanly?
4. Was the problem caused by tuning, sensing, or the process?
5. What would you check in a real BAS before changing tuning?

> Commissioning Note: The best training outcome is not "the user memorized which slider to move." The best outcome is that the user can explain why a control change should or should not solve the observed trend.
