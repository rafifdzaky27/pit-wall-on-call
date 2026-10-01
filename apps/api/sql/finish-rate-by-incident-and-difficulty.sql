-- Finish and DNF rate per incident and difficulty (M6 spec H10). Read-only.
-- Same as finish-rate-by-incident.sql, split into normal and hard. Flagged runs are excluded.
-- Run: docker compose exec -T postgres psql -U pitwall -d pitwall < apps/api/sql/finish-rate-by-incident-and-difficulty.sql
select
  scenario_id,
  difficulty,
  count(*) as runs,
  count(*) filter (where resolved) as finished,
  count(*) filter (where not resolved) as dnf,
  round(100.0 * count(*) filter (where resolved) / count(*), 1) as finish_pct,
  round(100.0 * count(*) filter (where not resolved) / count(*), 1) as dnf_pct
from runs
where flagged = false
group by scenario_id, difficulty
order by scenario_id, difficulty;
