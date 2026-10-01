-- Finish and DNF rate per incident. Read-only.
-- finished = the shift ended resolved; dnf = it ended unresolved. Flagged runs are excluded.
-- Run: docker compose exec -T postgres psql -U pitwall -d pitwall < apps/api/sql/finish-rate-by-incident.sql
select
  scenario_id,
  count(*) as runs,
  count(*) filter (where resolved) as finished,
  count(*) filter (where not resolved) as dnf,
  round(100.0 * count(*) filter (where resolved) / count(*), 1) as finish_pct,
  round(100.0 * count(*) filter (where not resolved) / count(*), 1) as dnf_pct
from runs
where flagged = false
group by scenario_id
order by runs desc, scenario_id;
