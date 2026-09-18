# Conformance and benchmark rules

CVX treats tests as compatibility and regression gates rather than a taxonomy of unit, behavior, property, or type suites.

The package exposes only the workflow commands the repository actually uses:

```bash
bun run test
bun run coverage
bun run bench
```

Run an individual file directly with Bun when debugging, for example `bun test tests/correctness.test.ts`. Dedicated `test:*` package scripts are intentionally not maintained.

## Conformance gates

Executable suites live directly under `tests/` and are named after the contract they protect:

- `correctness.test.ts` compares public CVX behavior with the supported reference implementations across explicit regression batteries and broad matrices.
- `fuzz.test.ts` uses deterministic generated inputs to find parity gaps and cross-path inconsistencies that hand-written cases miss.
- `cv.test.ts` protects CVX-specific variant, composition, snapshot, dense/general, and foreign-component semantics.
- `cx.test.ts` protects the supported class-value grammar and ordering semantics.
- `compiler.test.ts` verifies conflict-model compilation, table/source equivalence, configuration transforms, subsetting, and cache-independent execution.
- `hardening.test.ts` stresses high-cardinality, wide-conflict, cache-churn, repeated dense lookup, and end-to-end paths that ordinary correctness cases do not reach.
- `public.test.ts` protects only release-critical package and public-export boundaries.

Reusable deterministic data lives under `tests/fixtures/`. Small reusable traversal/random/parity helpers live under `tests/utility/`; helpers should exist only when they remove repeated test logic, not to create another testing abstraction layer.

Standalone type-test files are intentionally omitted. Source typing is validated by `bun run check`, while public inference is exercised by normal package compilation and executable TypeScript test usage.

## Differential testing

Where a compatible reference exists, CVX should be tested differentially instead of reproducing expected outputs by hand:

- `cx` against `clsx` for the supported class-value grammar.
- `cn` against `clsx + tailwind-merge` for default Tailwind conflict behavior.
- internal configured `cn` paths against equivalent `tailwind-merge` configuration extensions.
- `cv` against the supported CVA reference where the observable semantics overlap.

Reference parity does not replace CVX-specific tests. Composition, dense compilation, internal variants, configuration snapshots, and other CVX behavior need explicit regression coverage even when no upstream oracle exists.

## Fuzzing

Generated tests must be deterministic. Every fuzz loop uses a fixed seed so a failure can be reproduced exactly.

Fuzz cases should exercise grammar combinations and state transitions rather than random bytes: nested class values, modifiers, arbitrary values, defaults, compounds, invalid selections, cache churn, and compiled/general CV paths.

## Hardening

Hardening cases exist for failure modes that normal parity suites are unlikely to reach. Favor cases that stress bounds, high cardinality, cache lifecycle, large conflict fan-out, repeated compiled access, or historical regressions.

Do not add micro-tests only to increase coverage. A hardening test should protect a concrete invariant or failure class.

## Benchmarks

`tests/compare.bench.ts` is measurement code, not a correctness test. It must not contain pass/fail speed thresholds because shared CI runners are noisy.

Every benchmark comparison should follow these rules:

1. Compare equivalent public behavior.
2. Prepare input corpora outside timed regions unless input creation is itself the workload.
3. Keep stable-cache, bounded-working-set, cache-hostile, cold creation, and hot resolver workloads separate.
4. Use independent cursors for rotating inputs so every implementation observes the same distribution.
5. Warm and calibrate before measurement and preserve raw samples in CI artifacts.
6. Record runtime, CPU, architecture, and dependency versions alongside results.
7. Prefer corpus replay from real application call shapes over one synthetic headline loop when making broad performance claims.
8. Real-repository corpora live under `tests/fixtures/corpora/` as deterministic gzip snapshots with source URLs, call counts, and payload checksums in `manifest.json`. Corpus workers replay calls in repository order so recurring call sites and one-off strings preserve their captured locality.
9. Corpus performance must run each implementation/repository pair in an isolated process and verify `cn` parity against `clsx + tailwind-merge` before timing.
10. Never turn workload-specific ratios into one aggregate "CVX is N× faster" claim.

The checked-in corpus snapshots intentionally do not claim to represent the current state of their source repositories. The original capture did not retain commit hashes; `revision` therefore remains `null` until a corpus is independently re-harvested with revision metadata.

The comparison suite should keep both strengths and trade-offs visible. In particular, CV preparation cost must remain separate from repeated resolver cost, and `cn` cache-hit numbers must remain separate from cache-hostile parser/conflict work.
