# 11. PID Tuning Methodologies

This lesson is now a methodology map rather than a second copy of the tuning-method details. Use it to decide which detailed lesson to open next.

## Canonical Lessons

| Need | Go to | Why |
| --- | --- | --- |
| Understand the Lab tuning card and its inputs | `0.35 Standard Tuning Methods` | This is the canonical section for Cohen-Coon, Ziegler-Nichols, Tyreus-Luyben, relay autotune, IMC/Lambda, and bump test behavior in the app. |
| Compare P, PI, and PID before tuning | `0.3 Controller Settings Explained` and `3. Choosing the Right Controller` | These sections explain what terms are active before a method recommends numbers. |
| Tune from exported trend data or outside software | `18. Data-Driven and Model-Based PID Tuning` | This section covers model identification, implementation matching, and simulation before field changes. |
| Validate tuning after the change | `0.05 Stability Checker & Metrics Explained`, `12. Practical Field Tuning Workflow`, and `13. Long-Term Performance Evaluation` | These sections explain whether the result is stable, repeatable, and acceptable across conditions. |
| Translate tuning across vendor platforms | `21. Vendor PID Controller Technical Background` | Vendor terms can invert meaning, especially gain versus proportional band or throttling range. |

<!-- widget:tuning-method-timeline -->

## Method Selection Guidance

Use this page as a routing checklist:

1. If the operator is using the built-in Lab study panel, open `0.35 Standard Tuning Methods`.
2. If the operator has CSV or trend data from a real system, open `18. Data-Driven and Model-Based PID Tuning`.
3. If the loop is already unstable or close to a limit, open `9. Anti-Windup, Bumpless Transfer, and Mode Changes` before trying to tune faster.
4. If a vendor faceplate uses unfamiliar terms, open `21. Vendor PID Controller Technical Background` before copying any numbers.

## Why This Section Is Short

Earlier versions of the Learn library repeated the same method table in multiple places. That made the path harder to follow. The detailed explanations now live in one place:

- `0.35 Standard Tuning Methods` for the app's standard tuning studies
- `18. Data-Driven and Model-Based PID Tuning` for exported data and external model-based workflows
- `21. Vendor PID Controller Technical Background` for vendor-specific tuning terms

> Training Note: Do not copy tuning values blindly between lessons, vendors, or loops. First identify the controller form, proportional-unit convention, integral-unit convention, interval, limits, and mode-change behavior.
