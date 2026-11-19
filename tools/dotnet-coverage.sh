#!/bin/sh
# Usage: sh coverage-index/tools/dotnet-coverage.sh <test project> <out dir>
#
# Runs the tests once with coverlet for the report, then each test method on its own so the report can name the tests
# that ran each line. Writes <out dir>/coverage.cobertura.xml and <out dir>/tests/<test>.xml for
# tools/cobertura-istanbul.mjs. The test project needs the coverlet.collector package. Failing tests don't stop it.
project=$1
out=$2

rm -rf "$out"
mkdir -p "$out/tests"
dotnet build "$project"

collect() {
  dotnet test "$project" --no-build --collect:"XPlat Code Coverage" --results-directory "$out/run" "$@"
  for file in "$out"/run/*/coverage.cobertura.xml; do
    [ -f "$file" ] && mv "$file" "$target"
  done
  rm -rf "$out/run"
}

target="$out/coverage.cobertura.xml"
collect

# Theory cases are listed with their arguments; each method runs once with all its cases.
dotnet test "$project" --no-build --list-tests | tr -d '\r' | sed -n 's/^    \([^( ]*\).*/\1/p' | sort -u > "$out/tests.txt"
while read -r test; do
  echo "Coverage for $test"
  target="$out/tests/$test.xml"
  collect --filter "FullyQualifiedName=$test" > /dev/null
done < "$out/tests.txt"
rm -f "$out/tests.txt"
