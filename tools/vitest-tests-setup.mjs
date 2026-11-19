// Vitest setup file for coverage with provider 'istanbul': records which source lines each test ran, for
// tools/vitest-tests-reporter.mjs to write as tests.json. It compares istanbul's hit counters before and after each
// test, so lines that run while a test file loads or in its beforeAll hooks go to that file instead of a test.
import { afterEach, beforeEach } from 'vitest';

const STORE = '__VITEST_COVERAGE__';

function snapshot() {
  const copy = {};
  for (const [file, data] of Object.entries(globalThis[STORE] ?? {})) copy[file] = { s: { ...data.s }, f: { ...data.f } };
  return copy;
}

function linesRunSince(before) {
  const lines = {};
  for (const [file, data] of Object.entries(globalThis[STORE] ?? {})) {
    const run = new Set();
    for (const [id, count] of Object.entries(data.s)) {
      if (count > (before[file]?.s[id] ?? 0)) run.add(data.statementMap[id].start.line);
    }
    for (const [id, count] of Object.entries(data.f)) {
      if (count > (before[file]?.f[id] ?? 0)) run.add((data.fnMap[id].decl ?? data.fnMap[id].loc).start.line);
    }
    if (run.size) lines[data.path ?? file] = [...run];
  }
  return lines;
}

let last = snapshot();
let start;

beforeEach(({ task }) => {
  task.meta.linesRunOutsideTests = linesRunSince(last);
  start = snapshot();
});

afterEach(({ task }) => {
  task.meta.linesRun = linesRunSince(start);
  last = snapshot();
});
