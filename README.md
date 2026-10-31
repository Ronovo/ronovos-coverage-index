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
| `tools/functions.py` | Reads coverage.py's JSON report and writes `functions.json`, the per-file function counts that coverage.py's summary lacks. The page uses it for the Functions column. |

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
  reads it (`coverage.py` or `istanbul`), and `functions` the optional `functions.json` for formats whose summary
  has no function counts. istanbul's summary has them, so its report needs no `functions` entry.
- A project with one test suite lists one report. Another format is one more entry in the page's `formats` table.

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

[html]
directory = coverage/python
title = Python server coverage
extra_css = coverage-index/coverage-py.css
skip_empty = True
```

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

```js
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'json-summary'],
  reportsDirectory: 'coverage/js',
}
```

`json-summary` writes the `coverage-summary.json` the page reads. After `vitest run --coverage`:

```sh
cat coverage-index/istanbul.css >> coverage/js/base.css
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
