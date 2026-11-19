# Ronovo's coverage index

One landing page for a project's test coverage reports, the same in every project. It shows each report's total
and lists every measured file in one sortable table, with a link to each file's line-by-line page. The line-by-line
pages that coverage.py and istanbul write keep doing the detail work, restyled with GitHub's diff colours.

## What is in here

| File | What it is |
|---|---|
| `index.html` | The landing page. It reads the `reports.json` next to it and each report's data files. Nothing in it is project-specific. |
| `coverage-py.css` | Loaded into coverage.py's pages through its `extra_css` setting: GitHub diff colours, lines coloured only while their button is pressed, and the "run" button labelled "covered". |
| `istanbul.css` | The same colours for istanbul's pages. istanbul has no extra-css setting, so the build appends this to its `base.css`. |
| `istanbul-tests.js` | Appended to istanbul's `block-navigation.js`: clicking a line number lists the tests that ran that line, from the report's `tests.json`. |
| `tools/functions.py` | Reads coverage.py's JSON report and writes `functions.json`, the per-file function counts that coverage.py's summary lacks. The page uses it for the Functions column. |
| `tools/vitest-tests-setup.mjs`, `tools/vitest-tests-reporter.mjs` | A Vitest setup file and reporter that record which tests ran each line and write `tests.json` into the coverage folder. |
| `tools/dotnet-coverage.sh` | Runs a .NET test project with coverlet once for the report and once per test method for `tests.json`. |
| `tools/cobertura-istanbul.mjs` | Turns that coverlet output into istanbul's pages, `coverage-summary.json` and `tests.json`. Its packages are in `tools/package.json`. |
| `tools/tests-json.mjs` | Writes `tests.json` for the Vitest reporter and the Cobertura tool. |

A project adds one file of its own, `reports.json`, which names the project and its reports. It lives in the
project, not in this repository; the examples below keep it at the project root as `coverage-reports.json`.

```json
{
  "title": "My project",
  "source": "https://github.com/<user>/<repo>",
  "reports": [
    { "label": "Python server", "path": "python/", "summary": "status.json", "functions": "functions.json", "format": "coverage.py",
      "about": "src/ and app.py, measured with coverage.py" },
    { "label": "JavaScript client", "path": "js/", "summary": "coverage-summary.json", "format": "istanbul",
      "about": "static/js, measured with Vitest" }
  ]
}
```

- `path` is the report's folder beside the page, `summary` the file with its per-file numbers, `format` which parser
  reads it, and `functions` the optional `functions.json` for formats whose summary has no function counts.
  istanbul's summary has them, so its report needs no `functions` entry.
- A project with one test suite lists one report. Another format is one more entry in the page's `formats` table.

| `format` | Written by | `summary` | Pages |
|---|---|---|---|
| `coverage.py` | coverage.py's `html` report | `status.json` | coverage.py's own, plus `functions.json` from `tools/functions.py` |
| `istanbul` | Vitest, Jest, c8 and nyc with the `html` and `json-summary` reporters, and `tools/cobertura-istanbul.mjs` for coverlet (C#) | `coverage-summary.json` | istanbul's own |
| `jacoco` | JaCoCo's `xml` and `html` reports (Java) | `jacocoTestReport.xml` | JaCoCo's own |

## Setting up a project

Add this repository as a submodule at `coverage-index/`:

```sh
git submodule add https://github.com/Ronovo/ronovos-coverage-index coverage-index
```

Updating a project is then a submodule bump. The served folder ends up as `coverage/index.html`,
`coverage/reports.json`, and one folder per report.

### coverage.py

```ini
[run]
branch = True
dynamic_context = test_function

[html]
directory = coverage/python
title = Python server coverage
extra_css = coverage-index/coverage-py.css
skip_empty = True
show_contexts = True
```

`dynamic_context` records which test ran each line and `show_contexts` lists those tests on the line's page.

The build steps, after the tests have run:

```sh
python -m coverage html --fail-under=0
python -m coverage json --fail-under=0 -o coverage.json
python coverage-index/tools/functions.py coverage.json coverage/python/functions.json
```

A function counts as covered when at least one of its lines ran, which is what istanbul's function metric means.
Functions with nothing to run, such as abstract stubs with only a docstring, stay out of the count. By default
coverage.py's pages start with "missing", "partially run" and "excluded" pressed and "covered" not. To start with
"covered" pressed as well, edit the report's script after `coverage html`:

```sh
sed -i 's/{run: false, exc: true, mis: true, par: true}/{run: true, exc: true, mis: true, par: true}/' coverage/python/coverage_html_cb_*.js
```

### Vitest

With the `@vitest/coverage-istanbul` package at the same version as Vitest:

```js
test: {
  setupFiles: ['coverage-index/tools/vitest-tests-setup.mjs'],
  reporters: ['default', 'coverage-index/tools/vitest-tests-reporter.mjs'],
  coverage: {
    provider: 'istanbul',
    reporter: ['text', 'html', 'json-summary'],
    reportsDirectory: 'coverage/js',
  },
}
```

`json-summary` writes the `coverage-summary.json` the page reads, and the setup file and reporter write `tests.json`
beside it. The setup file reads istanbul's hit counters, so it needs the `istanbul` provider; ignore hints are
`/* istanbul ignore next */`, not `/* v8 ignore next */`. After `vitest run --coverage`:

```sh
cat coverage-index/istanbul.css >> coverage/js/base.css
cat coverage-index/istanbul-tests.js >> coverage/js/block-navigation.js
```

c8 writes the same report: put `"html"` and `"json-summary"` in its `reporter` list and append `istanbul.css` the
same way. It has no `tests.json`, so its pages don't list tests.

### coverlet (.NET)

The test project needs the `coverlet.collector` package. After the tests have run, the report is written from the
same `tools/` as Vitest's, which needs Node.js:

```sh
sh coverage-index/tools/dotnet-coverage.sh Tests/MyApp.Tests.csproj coverage/dotnet-raw
npm ci --prefix coverage-index/tools
node coverage-index/tools/cobertura-istanbul.mjs coverage/dotnet-raw coverage/dotnet
cat coverage-index/istanbul.css >> coverage/dotnet/base.css
cat coverage-index/istanbul-tests.js >> coverage/dotnet/block-navigation.js
```

`dotnet-coverage.sh` runs the whole suite once for the report, then each test method on its own to see which lines
it runs, so it takes one test-host start per test method. In `reports.json` the report is an `istanbul` one with
`coverage-summary.json` as its summary. Cobertura only records lines, so each line counts as one statement and a
partly covered line shows its branches as one count rather than marking which path was missed.

### JaCoCo

```groovy
plugins {
    id 'java'
    id 'jacoco'
}

jacocoTestReport {
    reports {
        xml.required = true
        html.required = true
    }
}
test.finalizedBy jacocoTestReport
```

Gradle writes the pages to `build/reports/jacoco/test/html/` and the summary to
`build/reports/jacoco/test/jacocoTestReport.xml`. Serve the html folder as the report and copy the xml into it:

```sh
cp build/reports/jacoco/test/jacocoTestReport.xml build/reports/jacoco/test/html/
```

### Dockerfile

Copy the page and the project's `reports.json` into the served folder, and each report's folder beside them:

```dockerfile
COPY coverage-index/index.html coverage/
COPY coverage-reports.json coverage/reports.json
COPY --from=python-coverage /src/coverage/python coverage/python
COPY --from=js-coverage /src/coverage/js coverage/js
```

Serve `coverage/` as static files. The page's script is inline, so serve it without a Content-Security-Policy
that forbids that.
