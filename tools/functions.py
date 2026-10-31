"""Writes functions.json for the coverage page: per file, how many functions have something to run and how many ran.

Usage: python coverage-index/tools/functions.py <coverage.json> <functions.json to write>

coverage.py's summary file has no function counts, so the page reads this for its Functions column. Functions with
no statements or branches, such as abstract stubs, are left out.
"""
import json
import sys
from pathlib import Path


def main(report_path: str, out_path: str) -> None:
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    files = {}
    for filename, data in report["files"].items():
        regions = [region for name, region in data.get("functions", {}).items()
                   if name and (region["summary"]["num_statements"] or region["summary"]["num_branches"])]
        files[Path(filename).as_posix()] = {
            "measured": len(regions),
            "called": sum(bool(region["executed_lines"]) for region in regions),
        }
    Path(out_path).write_text(json.dumps(files), encoding="utf-8")


if __name__ == "__main__":
    main(*sys.argv[1:])
