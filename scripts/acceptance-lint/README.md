# Acceptance script static analysis

The uploaded agent uses the committed `volo/vendor/acceptance-lint.cjs` bundle.
There is no npm install or code evaluation during acceptance planning. The bundle
parses CommonJS ES2022 and reports unresolved names using Acorn and ESLint Scope.
Browser callback globals are allowed alongside standard Node globals.

Rebuild after changing the checker or pinned dependencies:

```sh
npm ci --prefix scripts/acceptance-lint --ignore-scripts
node scripts/acceptance-lint/build.cjs
```

The build also copies upstream licenses. Package versions and registry integrity
hashes are pinned in `package-lock.json`. Static checks catch syntax and undefined
variables; semantic coverage and correct test data still require actual validation.

Primary references: [Acorn API](https://github.com/acornjs/acorn/blob/master/acorn/README.md),
[ESLint Scope API](https://github.com/eslint/js/tree/main/packages/eslint-scope).
