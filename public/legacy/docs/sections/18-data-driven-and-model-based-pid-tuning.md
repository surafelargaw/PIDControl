# 18. Data-Driven and Model-Based PID Tuning

Manual tuning still matters, but modern PID work increasingly starts from measured data instead of guesswork. When you can capture clean trend data, software-assisted tuning gives you a safer way to compare options before the live loop sees them.

<!-- widget:data-driven-tuning-workflow -->

## Scope Of This Lesson

Use `0.35 Standard Tuning Methods` for the built-in Lab methods such as Cohen-Coon, Ziegler-Nichols, relay autotune, IMC/Lambda, and bump test.

Use this lesson when the workflow starts with exported trend data, spreadsheet/CSV analysis, external modeling software, or a formal comparison of candidate tuning values before touching the live loop.

## What This Approach Adds

- Import trend, spreadsheet, or CSV data instead of relying on a short commissioning memory
- Fit a first-order, second-order, or transfer-function style model to the measured process
- Optimize PID gains against that model rather than only against a heuristic rule
- Simulate the closed loop before touching the live plant
- Match the actual controller form so the final numbers mean the same thing in the BAS or PLC

## Practical Workflow

| Step | What You Need | Why It Matters |
| --- | --- | --- |
| Capture a clean event | SP, PV, CV, timestamps, and notes on mode or limit changes | Bad data guarantees misleading model fits |
| Start simple | A first-order-plus-deadtime style fit is usually the first stop | Simpler models are easier to validate and explain |
| Escalate only when needed | Move to second-order or custom transfer functions when the simpler fit clearly misses the dominant behavior | Complexity should solve a real mismatch, not just look impressive |
| Match implementation | Verify controller form, integral definition, derivative source, filters, and limits | A correct model paired with the wrong field implementation still fails |
| Simulate multiple cases | Test setpoint steps, disturbances, saturation, and mode changes | Good tuning has to survive more than one ideal scenario |

## When to Prefer Data-Driven Tuning

- Slow thermal loops where live experiments take too long
- Loops that are expensive to overshoot
- Systems with several plausible tuning options and no safe appetite for repeated live testing
- Loops that interact with filters, feedforward, or non-default controller features

## Field Notes

- Model quality depends more on test quality than on tool sophistication
- A clear controller-form mismatch can waste more time than a mediocre gain guess
- Trend export should include timestamps and context, not just a screenshot
- Simulation should include limits, filters, and the same algorithm choices used in production

## Further Reading

- [PID Tuner](https://pidtuner.github.io/#/)
- [PID-Tuner guides](https://www.pid-tuner.com/guides/)
- [What are good strategies for tuning PID loops?](https://robotics.stackexchange.com/questions/167/what-are-good-strategies-for-tuning-pid-loops)
