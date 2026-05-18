# 20. Robotics and Motion-Control PID Notes

Fast motion loops teach a few lessons that are useful well beyond robotics: protect the hardware first, respect sampling and resonance, and remember that feedforward can outperform blind gain-cranking.

## Practical Heuristics Worth Borrowing

- Start with P, then add I, and only bring in D when the signal quality and dynamics justify it
- Put safety limits in place before aggressive tuning begins
- If the loop is fast enough, think in terms of frequency response instead of only step response
- Use filters deliberately when resonance or noise is part of the real plant
- Add feedforward when the commanded motion or load relation is already known

## Manual Tuning vs Measurement

The robotics community often splits tuning into two camps:

- Quick baseline tuning: raise proportional action until the loop becomes lively, then add damping and only afterward add enough integral action to remove drift
- Measured design: identify the plant from data, or sweep frequency response, then tune against overshoot, settling time, and stability margin intentionally

Both approaches can work. The second is usually stronger when the plant is valuable, fast, or mechanically sensitive.

## What Motion Loops Expose Clearly

| Check | Why It Matters | Practical Response |
| --- | --- | --- |
| Sampling rate | A slow controller can destabilize a fast plant even with reasonable gains | Make sure the loop runs fast enough before blaming the gains |
| Resonance | Mechanical modes can look like mysterious tuning failure | Use notch or low-pass filtering where appropriate and confirm the oscillation source |
| Saturation | Current, torque, speed, or position limits change the effective loop | Tune with real limits in mind instead of pretending they do not exist |
| Cascade structure | Position, velocity, and torque loops may not be independent | Tune inner loops first and understand what each layer is controlling |
| Feedforward | Good plant knowledge can reduce error before feedback reacts | Add the predictable part of the needed command directly |

## Why This Helps HVAC and Process Loops Too

Even though HVAC loops are slower, the same discipline still applies:

- Verify limits before tuning
- Be cautious with derivative on noisy measurements
- Use feedforward when a measurable disturbance is available
- Prefer data and models over repeated blind trials when the cost of mistakes is high

## Further Reading

- [What are good strategies for tuning PID loops?](https://robotics.stackexchange.com/questions/167/what-are-good-strategies-for-tuning-pid-loops)
- [PID Tuning Guide](https://tlk-energy.de/blog-en/practical-pid-tuning-guide)
- [PID Tuner](https://pidtuner.github.io/#/)
