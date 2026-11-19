// Vitest reporter that writes tests.json into the coverage folder from what tools/vitest-tests-setup.mjs recorded.
import { relative, resolve } from 'node:path';
import { createTestLines } from './tests-json.mjs';

export default class TestsReporter {
  onInit(vitest) {
    this.vitest = vitest;
  }

  onTestRunEnd(testModules) {
    const { root, coverage } = this.vitest.config;
    if (!coverage.enabled) return;
    const tests = createTestLines();
    for (const module of testModules) {
      const file = relative(root, module.moduleId).replaceAll('\\', '/');
      for (const test of module.children.allTests()) {
        const { linesRun = {}, linesRunOutsideTests = {} } = test.meta();
        for (const [source, lines] of Object.entries(linesRunOutsideTests)) tests.add(source, lines, `${file} (outside a test)`);
        for (const [source, lines] of Object.entries(linesRun)) tests.add(source, lines, `${file} > ${test.fullName}`);
      }
    }
    tests.write(resolve(root, coverage.reportsDirectory, 'tests.json'));
  }
}
