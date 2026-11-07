#!/bin/sh
# Пази правилото за публичното repo на всеки PR (ci.yml): само deploy.yml ползва self-hosted runner-а на homesrv
# (label recepturnik), иска го с този label и никога не тръгва за PR. Хваща грешка в repo-то, не враждебен PR от
# fork, който може да смени и този скрипт: срещу него е одобрението на workflow-ите от fork (infra/README.md).
# Usage: check-workflows.sh [workflows dir, default .github/workflows]
set -eu

dir=${1:-.github/workflows}
deploy=$dir/deploy.yml
status=0

# Редовете на файл $1, които съвпадат с ERE $2 без значение от регистъра (label-ите на runner-а не го различават),
# без редовете с коментар.
hits() {
  grep -inE "$2" "$1" | grep -vE '^[0-9]+:[[:space:]]*#' || true
}

# report <file> <message> [matching lines]
report() {
  echo "::error file=$1::$2"
  [ -z "${3:-}" ] || printf '%s\n' "$3"
  status=1
}

for file in "$dir"/*.yml "$dir"/*.yaml; do
  [ -f "$file" ] && [ "$file" != "$deploy" ] || continue
  found=$(hits "$file" 'self-hosted|runs-on:.*(recepturnik|homesrv|family)')
  [ -z "$found" ] || report "$file" 'only deploy.yml may use the self-hosted runner (infra/README.md)' "$found"
done

if [ ! -f "$deploy" ]; then
  report "$deploy" 'deploy.yml is missing'
else
  # pull_request* пуска кода на PR-а; workflow_run тръгва веднага след workflow на PR.
  found=$(hits "$deploy" 'pull_request|workflow_run')
  [ -z "$found" ] || report "$deploy" 'deploy.yml runs only on push to master and workflow_dispatch' "$found"
  found=$(hits "$deploy" 'runs-on:.*recepturnik')
  [ -n "$found" ] || report "$deploy" 'runs-on of deploy.yml must contain the recepturnik label'
  found=$(hits "$deploy" "if: github\.ref == 'refs/heads/master'")
  [ -n "$found" ] || report "$deploy" "the deploy job must be guarded by if: github.ref == 'refs/heads/master'"
fi

exit "$status"
