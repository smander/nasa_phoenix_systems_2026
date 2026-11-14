# StateBadge

The four-state pill that heads the sky: Power and contact, Power only, Contact only, Blackout.

Provide `state` (`both` | `sun` | `earth` | `none`) and optionally `animateKey` (change it to replay the flip). Text comes from the fixed copy in section 7.1 — don't rename states.

- Always sits on `sky-bg` and uses the `sky-*` colours so it reads the same in both themes.
- The dot breathes (`dur-breath`); Blackout's dot is hatched and still, so the state never depends on colour alone.
