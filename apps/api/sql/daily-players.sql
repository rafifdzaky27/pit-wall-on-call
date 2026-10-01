-- Players and runs per UTC day, with how many of those players are playing for the first time. Read-only.
-- Run: docker compose exec -T postgres psql -U pitwall -d pitwall < apps/api/sql/daily-players.sql
with plays as (
  select player_id, (created_at at time zone 'UTC')::date as day
  from runs
  where flagged = false
),
first_day as (
  select player_id, min(day) as first_day
  from plays
  group by player_id
)
select
  p.day,
  count(distinct p.player_id) as players,
  count(*) as runs,
  count(distinct p.player_id) filter (where f.first_day = p.day) as new_players
from plays p
join first_day f using (player_id)
group by p.day
order by p.day;
