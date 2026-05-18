# 8. Integral Behavior and Vendor Implementation Differences

Integral action is conceptually simple but platform behavior is not always identical.

Some systems implement integral action as a direct accumulation of error over time, while others back-calculate the integral term from the output to support anti-windup and bumpless transfer.

## Why This Matters

These approaches can feel different in the field even when the interface labels look similar. Two controllers may both offer “integral time,” but one may continue accumulating aggressively when the actuator is limited while another may automatically track the practical output state more gracefully.

## Tuning Implications

- Direct-accumulation implementations usually reward more conservative integral settings
- Back-calculated implementations can often tolerate somewhat stronger integral action
- Output limits, mode changes, and operator overrides may reveal these differences more clearly than steady operation

## Practical Guidance Without Naming Vendors

- Start with modest integral on any unfamiliar platform
- Observe what happens when the output saturates or hits a minimum
- Check whether the loop returns smoothly from Manual to Auto
- Review trend data, not just the faceplate, when evaluating integral behavior

## Platform-Specific Behavior: What to Watch For

Different BAS platforms implement integral accumulation in ways that produce meaningfully different field behavior even when the interface labels look identical.

**Direct-accumulation platforms (e.g. CODESYS-based controllers):**
- The integral term accumulates error multiplied by time directly: `I += error × (1/Ti) × dt`
- When the output saturates at a limit, accumulation can continue unchecked if anti-windup is not explicitly configured
- This tends to reward **conservative integral settings** — longer Ti values that accumulate slowly
- After the output limit releases, the wound-up integral can produce significant overshoot before it unwinds
- In datacenter cooling loops: verify that anti-windup conditioning is active before relying on tight integral settings

**Back-calculated integral platforms (e.g. Rockwell ControlLogix PIDE):**
- The integral term is derived from the difference between the commanded output and the actual output (back-calculation), not purely from error accumulation
- When output saturates, back-calculation automatically reduces the integral contribution — built-in anti-windup behavior
- These implementations generally **tolerate more aggressive integral action** because saturation is handled structurally rather than by configuration
- Bumpless transfer from Manual to Auto is typically supported natively through integral tracking
- In datacenter cooling loops: still start conservatively, but you can increase integral authority more confidently if response is sluggish

**Practical checklist for any new platform:**

| Check | What to do |
|-------|-----------|
| Output saturation behavior | Step the SP hard enough to saturate the output; observe whether the PV overshoots badly on recovery |
| Manual-to-Auto transfer | Switch from Manual to Auto while at a non-zero output; verify there is no output bump |
| Integral limiting | Check whether the platform has a configurable integral limit separate from the output limit |
| Documentation | Find the vendor's description of their integral algorithm — “standard form” in the manual does not guarantee identical behavior |

> Commissioning Note: If one BAS appears “harder to tune” than another, the issue may be integral implementation and anti-windup behavior rather than the basic HVAC process itself.

> Design Consideration: When developing standards, describe expected loop behavior and verification steps rather than assuming that every BAS platform expresses integral action in the same way.
