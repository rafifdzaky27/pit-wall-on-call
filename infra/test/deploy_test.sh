#!/usr/bin/env bash
# Behavioural tests for infra/deploy.sh, run against a fake docker CLI.
# The fake reads the running tag from .env and is steered by env vars:
#   FAKE_PULL_FAIL=1       every pull fails (e.g. image missing)
#   FAKE_UP_FAIL_TAG=<t>   "compose up" fails while .env says TAG=<t>
#   FAKE_BAD_TAG=<t>       readiness fails while .env says TAG=<t>
#   FAKE_MIGRATE_FAIL=1    the one-shot migration fails
#   FAKE_SMOKE_FAIL_TAG=<t> the dry-run smoke replay fails while .env says TAG=<t>
# Every call is appended to calls.log, so tests can check what ran.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/site"
cp "$here/../deploy.sh" "$work/site/"

cat > "$work/bin/docker" <<'FAKE'
#!/usr/bin/env bash
cur="$(grep -E '^TAG=' .env 2>/dev/null | cut -d= -f2-)"
echo "$* (TAG=${TAG:-$cur})" >> calls.log
case "$*" in
  "compose pull"*) [[ "${FAKE_PULL_FAIL:-0}" != 1 ]] ;;
  "compose up -d --remove-orphans") [[ "$cur" != "${FAKE_UP_FAIL_TAG:-}" ]] ;;
  "compose run --rm -T api node dist/migrate.js") [[ "${FAKE_MIGRATE_FAIL:-0}" != 1 ]] ;;
  *"api sh -c"*dist/smoke.js*) [[ "$cur" != "${FAKE_SMOKE_FAIL_TAG:-}" ]] ;;
  *"api wget"*readyz*) [[ "$cur" != "${FAKE_BAD_TAG:-}" ]] ;;
  *"web wget"*api/version*) echo "{\"version\":\"$cur\"}" ;;
  "compose exec -T postgres psql"*) cat > psql_stdin.log; [[ "${FAKE_PSQL_FAIL:-0}" != 1 ]] ;;
  "image prune -f") exit 0 ;;
  *) echo "fake docker: unexpected: $*" >&2; exit 99 ;;
esac
FAKE
printf '#!/usr/bin/env bash\nexit 0\n' > "$work/bin/sleep"
chmod +x "$work/bin/docker" "$work/bin/sleep"

failures=0

# deploy <tag> [VAR=value ...]: run deploy.sh; sets $code and $tag
deploy() {
  local target="$1"
  shift
  code=0
  : > "$work/site/calls.log"
  (cd "$work/site" && env "$@" PATH="$work/bin:$PATH" bash ./deploy.sh "$target") \
    > "$work/out.log" 2>&1 || code=$?
  tag="$(grep -E '^TAG=' "$work/site/.env" | cut -d= -f2-)"
}

check() {
  local name="$1" want_code="$2" want_tag="$3"
  if [[ "$code" == "$want_code" && "$tag" == "$want_tag" ]]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name: exit=$code (want $want_code), TAG=$tag (want $want_tag)"
    sed 's/^/       /' "$work/out.log"
    failures=$((failures + 1))
  fi
}

fresh_env() { printf 'POSTGRES_PASSWORD=x\n' > "$work/site/.env"; }

fresh_env
deploy good1;                          check "first deploy, healthy" 0 good1
deploy good2;                          check "second deploy, healthy" 0 good2
deploy bad3 FAKE_BAD_TAG=bad3;         check "unhealthy deploy rolls back" 1 good2
deploy typo4 FAKE_PULL_FAIL=1;         check "missing image leaves production untouched" 1 good2
deploy upfail5 FAKE_UP_FAIL_TAG=upfail5; check "failing compose up rolls back" 1 good2
deploy mig7 FAKE_MIGRATE_FAIL=1;       check "failing migration leaves production untouched" 1 good2
if grep -q "compose up" "$work/site/calls.log"; then
  echo "FAIL - failing migration must not restart anything"; failures=$((failures + 1))
fi
deploy smoke8 FAKE_SMOKE_FAIL_TAG=smoke8; check "failing smoke replay rolls back" 1 good2
deploy good9;                          check "a healthy deploy migrates with the new tag first" 0 good9
if ! head -2 "$work/site/calls.log" | tail -1 | grep -q "compose run --rm -T api node dist/migrate.js (TAG=good9)"; then
  echo "FAIL - migration must run right after the pull, with the new tag"; sed 's/^/       /' "$work/site/calls.log"; failures=$((failures + 1))
fi
# Analytics profile (M5): deploy.sh provisions the umami role and database from .env.
# analytics_env <extra line> rewrites .env but keeps the running TAG.
analytics_env() {
  local keep
  keep="$(grep -E '^TAG=' "$work/site/.env" || true)"
  printf 'POSTGRES_PASSWORD=x\nCOMPOSE_PROFILES=tunnel,analytics\nUMAMI_APP_SECRET=app-secret\n%s\n%s\n' "$1" "$keep" > "$work/site/.env"
}
SECRET_PW='s3cretPassw0rd-DO_NOT_LEAK'

fresh_env
deploy plain10;                        check "no analytics profile: no database provisioning" 0 plain10
if grep -q "psql" "$work/site/calls.log"; then
  echo "FAIL - psql must not run without the analytics profile"; failures=$((failures + 1))
fi

analytics_env "UMAMI_DB_PASSWORD=$SECRET_PW"
deploy an11;                           check "analytics profile provisions umami and deploys" 0 an11
if ! grep -q "create database umami" "$work/site/psql_stdin.log" || ! grep -q "create role umami" "$work/site/psql_stdin.log"; then
  echo "FAIL - provisioning SQL must create the umami role and database"; failures=$((failures + 1))
fi
if ! grep -q "not exists" "$work/site/psql_stdin.log"; then
  echo "FAIL - provisioning must be idempotent (guarded by not exists)"; failures=$((failures + 1))
fi
if grep -q "$SECRET_PW" "$work/site/calls.log" "$work/out.log"; then
  echo "FAIL - the Umami password must never be printed or passed as an argument"; failures=$((failures + 1))
fi
if ! awk '/psql/ {p=NR} /compose up/ {u=NR} END {exit !(p && u && p < u)}' "$work/site/calls.log"; then
  echo "FAIL - provisioning must run before compose up"; sed 's/^/       /' "$work/site/calls.log"; failures=$((failures + 1))
fi

analytics_env "UMAMI_DB_PASSWORD="
deploy an12;                           check "analytics profile without a password refuses before changing anything" 1 an11
if grep -q "compose pull" "$work/site/calls.log"; then
  echo "FAIL - a missing password must abort before the pull"; failures=$((failures + 1))
fi

analytics_env "UMAMI_DB_PASSWORD=it's bad"
deploy an13;                           check "a password with unsafe characters is refused" 1 an11

analytics_env "UMAMI_DB_PASSWORD=$SECRET_PW"
deploy an14 FAKE_PSQL_FAIL=1;          check "failing provisioning leaves production untouched" 1 an11

fresh_env
deploy bad6 FAKE_BAD_TAG=bad6;         check "unhealthy first deploy fails loudly" 1 bad6

if [[ "$failures" -gt 0 ]]; then
  echo "$failures test(s) failed"
  exit 1
fi
echo "all deploy.sh tests passed"
