# Corpus fixtures

These benchmark-only fixtures contain class-composition argument tuples captured from the public repositories listed in `manifest.json`. Each repository is stored independently as deterministic gzip-compressed JSON so corpus replay can isolate repositories without shipping the data in the published npm package.

The original capture did not retain source commit hashes, so `revision` remains `null`. Do not describe these snapshots as current repository state. Replace a corpus with a newly harvested snapshot before making commit-specific claims.

`sha256` covers the canonical uncompressed JSON payload and is verified by the conformance suite.
