#!/usr/bin/env bash
# Build the saple CLI from a SAPLE checkout into .saple/ (kept out of git). The checkout itself is not modified:
# the tracked source of its current commit is exported and built in .saple/.
# Usage: tools/saple/build_saple.sh /path/to/SAPLE          (needs Rust 1.75+ and Z3: `brew install z3` or `pip install z3-solver`)
# Then:  npm run saple            one mission, compared with the direct calculation and the neural network
#        npm run saple:batch      many missions at every site, writes apps/web/public/data/saple/report.json
SRC="${1:-${SAPLE_SRC:-}}"
if [ -z "$SRC" ] || [ ! -f "$SRC/Cargo.toml" ]; then echo "usage: tools/saple/build_saple.sh /path/to/SAPLE"; exit 2; fi
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/.saple"
rm -rf "$OUT/src" && mkdir -p "$OUT/src" || exit 1
(cd "$SRC" && git archive HEAD Cargo.toml crates patterns examples demo scripts/z3-env.sh) | tar -x -C "$OUT/src" || exit 1
[ -f "$SRC/Cargo.lock" ] && cp "$SRC/Cargo.lock" "$OUT/src/"
COMMIT="$(cd "$SRC" && git rev-parse --short HEAD)"
cd "$OUT/src" || exit 1
source scripts/z3-env.sh || exit 1
LIB="$(dirname "$(dirname "$Z3_SYS_Z3_HEADER")")/lib"
CARGO_TARGET_DIR="$OUT/target" cargo build -p sable-cli --release || exit 1
BIN="$OUT/target/release/saple"
VERSION="$(DYLD_LIBRARY_PATH="$LIB" LD_LIBRARY_PATH="$LIB" "$BIN" --version)" || exit 1
printf '{ "bin": "%s", "libPath": "%s", "version": "%s", "commit": "%s" }\n' "$BIN" "$LIB" "$VERSION" "$COMMIT" > "$OUT/env.json"
echo "built $VERSION (commit $COMMIT) -> $BIN"
