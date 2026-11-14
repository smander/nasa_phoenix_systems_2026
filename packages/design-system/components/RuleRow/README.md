# RuleRow

One SAPLE rule with its verdict: icon, name, formal expression, kind, plain-language explanation.

Provide `title` (the rule in plain words: "Sunlight for the whole stay"), `why` (one plain sentence), `verdict` (`holds` → Pass, `violated` → Fail, `preview` → Not checked yet), `at` (first failing hour). The formal side — `name`, `kind`, `expr` — shows only with `showTech`; keep it for planners in the collapsed proof.

- The icon flips in with a small overshoot (`ease-spring`) whenever the verdict changes.
- Violated rows get a faint `poor` wash from the left; pair with a red marker on the mission MonthBar.
- Until the engine runs, use `preview` (dashed ring) — never show a green tick that wasn't verified.
