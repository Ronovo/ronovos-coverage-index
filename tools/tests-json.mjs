// Collects which tests ran which lines and writes the report's tests.json:
// {tests: [name, ...], files: {"/abs/path/file": {"12": [index into tests, ...]}}}
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function createTestLines() {
  const files = new Map();

  return {
    add(file, lines, test) {
      const key = file.replaceAll('\\', '/');
      if (!files.has(key)) files.set(key, new Map());
      const byLine = files.get(key);
      for (const line of lines) {
        if (!byLine.has(line)) byLine.set(line, new Set());
        byLine.get(line).add(test);
      }
    },

    write(path) {
      const tests = [...new Set([...files.values()].flatMap((byLine) => [...byLine.values()].flatMap((set) => [...set])))].sort();
      const index = new Map(tests.map((name, i) => [name, i]));
      const out = {};
      for (const [file, byLine] of files) {
        out[file] = Object.fromEntries([...byLine].sort(([a], [b]) => a - b)
          .map(([line, set]) => [line, [...set].map((name) => index.get(name)).sort((a, b) => a - b)]));
      }
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify({ tests, files: out }));
    },
  };
}
