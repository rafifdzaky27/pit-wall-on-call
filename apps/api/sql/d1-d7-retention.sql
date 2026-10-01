-- D1 / D7 retention by first-play day (UTC). Read-only.
-- A player's cohort is the UTC day of their first unflagged run. D1 and D7 count the
-- players from that cohort who played again exactly 1 / 7 days later. Cohorts younger
-- than 7 days show d7_players = 0 because the day has not happened yet; read them as "not yet".
-- Run: docker compose exec -T postgres psql -U pitwall -d pitwall < apps/api/sql/d1-d7-retention.sql
with plays as (
  select distinct player_id, (created_at at time zone 'UTC')::date as day
  from runs
  where flagged = false
),
cohorts as (
  select player_id, min(day) as cohort_day
  from plays
  group by player_id
)
select
  c.cohort_day,
  count(*) as players,
  count(*) filter (where d1.player_id is not null) as d1_players,
  round(100.0 * count(*) filter (where d1.player_id is not null) / count(*), 1) as d1_pct,
  count(*) filter (where d7.player_id is not null) as d7_players,
  round(100.0 * count(*) filter (where d7.player_id is not null) / count(*), 1) as d7_pct
from cohorts c
left join plays d1 on d1.player_id = c.player_id and d1.day = c.cohort_day + 1
left join plays d7 on d7.player_id = c.player_id and d7.day = c.cohort_day + 7
group by c.cohort_day
order by c.cohort_day;
