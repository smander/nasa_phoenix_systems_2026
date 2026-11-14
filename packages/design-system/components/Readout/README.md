# Readout

A big-numeral readout block (Sun, Earth, Energy, Observer height) for the row under the sky.

Provide `label`, `value` (number counts up over `dur-slow`; a string shows as-is), `decimals`, `signed` (adds + and true minus), `suffix` (e.g. `°`), `unit`, `state` + `tone` (dot colour), `caption`, `rows` ([[label, value]] shown in mono), `bracket` (console crop marks that grow on hover/focus).

- Lay four in `.pw-readouts`; hairline `line` dividers, 22px each side.
- Numerals in `big-numeral` (Archivo, width 110%, tabular).
