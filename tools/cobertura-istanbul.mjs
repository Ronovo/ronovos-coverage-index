// Turns coverlet's Cobertura output into istanbul's html and json-summary reports, plus tests.json.
//
// Usage: node coverage-index/tools/cobertura-istanbul.mjs <in dir> <report dir>
//
// <in dir> holds coverage.cobertura.xml from the full test run and tests/<test name>.xml from one run per test,
// as tools/dotnet-coverage.sh writes them. Cobertura only knows lines, so each measured line becomes one statement,
// each method one function, and each branching line one branch with its covered and total paths.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { createCoverageMap } from '@vitest/istanbul-lib-coverage';
import { create, createContext } from '@vitest/istanbul-lib-report';
import { createTestLines } from './tests-json.mjs';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (name) => ['source', 'package', 'class', 'method', 'line'].includes(name),
});

function readCobertura(path) {
  const { coverage } = parser.parse(readFileSync(path, 'utf8'));
  const sources = (coverage.sources?.source ?? []).map(String);
  const resolve = (filename) => {
    if (isAbsolute(filename)) return filename;
    const found = sources.map((source) => join(source, filename)).find(existsSync);
    return (found ?? join(sources[0] ?? '', filename)).replaceAll('\\', '/');
  };
  const classes = (coverage.packages?.package ?? []).flatMap((pkg) => pkg.classes?.class ?? []);
  return classes.map((cls) => ({ ...cls, path: resolve(cls.filename) }));
}

// Async methods and lambdas compile into nested classes such as Foo/<Run>d__5.MoveNext; name them after the method
// they came from.
function functionName(cls, method) {
  const nested = /\/<([^>]+)>/.exec(cls.name);
  const own = /^<([^>]+)>/.exec(method.name);
  const name = nested?.[1] ?? own?.[1] ?? method.name;
  return `${cls.name.split('/')[0].split('.').pop()}.${name}`;
}

function conditions(line) {
  const match = /\((\d+)\/(\d+)\)/.exec(line['condition-coverage'] ?? '');
  return match ? { covered: Number(match[1]), total: Number(match[2]) } : null;
}

function fileCoverages(classes) {
  const files = new Map();
  for (const cls of classes) {
    if (!files.has(cls.path)) files.set(cls.path, { lines: new Map(), methods: new Map() });
    const file = files.get(cls.path);
    for (const line of cls.lines?.line ?? []) {
      const number = Number(line.number);
      const known = file.lines.get(number);
      const branch = conditions(line);
      file.lines.set(number, {
        hits: Math.max(known?.hits ?? 0, Number(line.hits)),
        branch: known?.branch && (!branch || known.branch.covered >= branch.covered) ? known.branch : branch,
      });
    }
    for (const method of cls.methods?.method ?? []) {
      const numbers = (method.lines?.line ?? []).map((line) => Number(line.number));
      if (!numbers.length) continue;
      const first = Math.min(...numbers);
      const last = Math.max(...numbers);
      const hits = Math.max(...(method.lines.line.map((line) => Number(line.hits))));
      const key = `${first}-${last}`;
      const known = file.methods.get(key);
      file.methods.set(key, { name: known?.name ?? functionName(cls, method), first, last, hits: Math.max(known?.hits ?? 0, hits) });
    }
  }
  return files;
}

function toIstanbul(path, { lines, methods }) {
  const text = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n|\r/) : [];
  const span = (number) => {
    const source = text[number - 1] ?? '';
    const start = source.length - source.trimStart().length;
    return { start: { line: number, column: start }, end: { line: number, column: Math.max(start, source.trimEnd().length - 1) } };
  };
  const coverage = { path, statementMap: {}, s: {}, fnMap: {}, f: {}, branchMap: {}, b: {} };
  [...lines].sort(([a], [b]) => a - b).forEach(([number, { hits, branch }], i) => {
    coverage.statementMap[i] = span(number);
    coverage.s[i] = hits;
    if (branch) {
      const id = Object.keys(coverage.branchMap).length;
      coverage.branchMap[id] = { type: 'branch', line: number, loc: span(number), locations: Array.from({ length: branch.total }, () => span(number)) };
      coverage.b[id] = Array.from({ length: branch.total }, (_, path) => (path < branch.covered ? 1 : 0));
    }
  });
  [...methods.values()].sort((a, b) => a.first - b.first).forEach((method, i) => {
    const decl = span(method.first);
    coverage.fnMap[i] = { name: method.name, line: method.first, decl, loc: { start: decl.start, end: span(method.last).end } };
    coverage.f[i] = method.hits;
  });
  return coverage;
}

// tests/<namespace.Class.Method>.xml: the name shown is Class.Method.
function testLines(dir) {
  const tests = createTestLines();
  const folder = join(dir, 'tests');
  if (!existsSync(folder)) return tests;
  for (const entry of readdirSync(folder).filter((name) => name.endsWith('.xml'))) {
    const name = basename(entry, '.xml').split('.').slice(-2).join('.');
    for (const cls of readCobertura(join(folder, entry))) {
      const run = (cls.lines?.line ?? []).filter((line) => Number(line.hits) > 0).map((line) => Number(line.number));
      tests.add(cls.path, run, name);
    }
  }
  return tests;
}

function main(inDir, reportDir) {
  const map = {};
  for (const [path, file] of fileCoverages(readCobertura(join(inDir, 'coverage.cobertura.xml')))) {
    map[path] = toIstanbul(path, file);
  }
  const context = createContext({ dir: reportDir, coverageMap: createCoverageMap(map) });
  for (const report of ['html', 'json-summary']) create(report).execute(context);
  testLines(inDir).write(join(reportDir, 'tests.json'));
}

main(...process.argv.slice(2));
