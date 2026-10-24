# Energy estimate: method, sources and limits

The dashboard shows energy as a **range**, labelled an **estimate**. Anthropic publishes no
per-token or per-query energy figure for Claude, so nothing here is a measurement of Claude.

## Formula
For each API call: `Wh = outputTokens x Wh-per-output-token(model)`, summed over every call
(classifier and summary calls included). Low and high come from two coefficients per model.
Input tokens are ignored by default (`inputTokenWeight = 0`); the sources are per output token.

**Energy saved** = (every final answer on Opus) - (energy actually used), computed separately
for the low and the high coefficients. It can be negative.

## Sources and where each number comes from
| Number | Value | Source |
|---|---|---|
| 70B-class energy | 0.04 Wh per query, ~361 output tokens | ML.ENERGY benchmark v3.0, as tabulated in [Energy Use of AI Inference (arXiv 2509.20241)](https://arxiv.org/pdf/2509.20241). Llama 3.1 70B, 4xH100, BF16. |
| 405B-class energy | 0.21 Wh per query, ~367 output tokens | Same table. Llama 3.1 405B, FP8. |
| Full-stack overhead ratio | 0.24 Wh / 0.10 Wh = 2.4 | [Google, Gemini Apps (arXiv 2508.15734)](https://arxiv.org/abs/2508.15734) reports 0.24 Wh per median text prompt for the full serving stack. The 0.10 Wh chip-only figure is from a secondary summary, not confirmed in the paper text I could read. |
| Cross-check | ~0.3 Wh per typical ChatGPT query | Epoch AI estimate and OpenAI's CEO, via secondary reports. Not used in the formula. |

Derived: 70B class = 1.11e-4 Wh/token, 405B class = 5.72e-4 Wh/token.
Low = those values. High = low x 2.4.

## Assumptions (the weak points)
1. **Model mapping is a guess.** Haiku is treated as 70B-class, Opus as 405B-class, Sonnet as the
   geometric mean. Claude's real sizes are not public. The *relative* gap between tiers is what
   drives the "energy saved" number, so it is the most uncertain figure on the dashboard.
2. **Open models on H100s stand in for Claude on Anthropic's hardware.** Different hardware,
   batching and quantization can change per-token energy a lot.
3. **Per-query numbers divided by output length.** ML.ENERGY argues per-query is the right unit
   because output length varies; we divide to apply it to tokens we log.
4. **Input and reasoning tokens are not modelled.** Long prompts and extended thinking cost more.
5. **Carbon and water are not estimated.**

## How to change it
All coefficients live in `DEFAULT_ENERGY` in `src/main/usage/energy.ts`. Replacing them with
better numbers needs no other change.

## Not yet verified
- I could not read the ML.ENERGY leaderboard or the full text of arXiv 2509.20241 directly; its
  figures come from a search summary. Check them against the paper before publishing.
