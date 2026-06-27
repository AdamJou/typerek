create or replace function public.set_match_teams_admin(
  p_match_id uuid,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_reason text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.matches;
  v_after public.matches;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'admin_required';
  end if;

  if p_home_team_id is null or p_away_team_id is null or p_home_team_id = p_away_team_id then
    raise exception 'invalid_match_teams';
  end if;

  select * into v_before
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if v_before.result_confirmed_at is not null then
    raise exception 'match_result_already_confirmed';
  end if;

  if not exists (
    select 1
    from public.teams
    where id = p_home_team_id
      and tournament_id = v_before.tournament_id
  ) then
    raise exception 'invalid_home_team';
  end if;

  if not exists (
    select 1
    from public.teams
    where id = p_away_team_id
      and tournament_id = v_before.tournament_id
  ) then
    raise exception 'invalid_away_team';
  end if;

  if exists (
    select 1
    from public.match_predictions prediction
    join public.players player on player.id = prediction.first_scorer_player_id
    where prediction.match_id = p_match_id
      and prediction.no_scorer = false
      and player.team_id not in (p_home_team_id, p_away_team_id)
  ) then
    raise exception 'match_team_change_conflicts_with_predictions';
  end if;

  update public.matches
  set
    home_team_id = p_home_team_id,
    away_team_id = p_away_team_id,
    home_placeholder = null,
    away_placeholder = null,
    updated_at = now()
  where id = p_match_id
  returning * into v_after;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data,
    reason
  )
  values (
    v_user_id,
    'set_match_teams_admin',
    'matches',
    p_match_id,
    to_jsonb(v_before),
    to_jsonb(v_after),
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  return v_after;
end;
$$;

revoke all on function public.set_match_teams_admin(uuid, uuid, uuid, text) from public;
grant execute on function public.set_match_teams_admin(uuid, uuid, uuid, text) to authenticated;

with assignments(match_number, home_code, away_code) as (
  values
    (73, 'RSA', 'CAN'),
    (74, 'GER', 'PAR'),
    (75, 'NED', 'MAR'),
    (76, 'BRA', 'JPN'),
    (77, 'FRA', 'SWE'),
    (78, 'CIV', 'NOR'),
    (81, 'USA', 'BIH'),
    (86, 'ARG', 'CPV'),
    (88, 'AUS', 'EGY')
),
world_cup as (
  select id
  from public.tournaments
  where slug = 'world-cup-2026'
),
resolved as (
  select
    assignment.match_number,
    home_team.id as home_team_id,
    away_team.id as away_team_id
  from assignments assignment
  cross join world_cup tournament
  join public.teams home_team
    on home_team.tournament_id = tournament.id
   and home_team.provider = 'openfootball'
   and home_team.external_id = assignment.home_code
  join public.teams away_team
    on away_team.tournament_id = tournament.id
   and away_team.provider = 'openfootball'
   and away_team.external_id = assignment.away_code
)
update public.matches match
set
  home_team_id = resolved.home_team_id,
  away_team_id = resolved.away_team_id,
  home_placeholder = null,
  away_placeholder = null,
  updated_at = now()
from resolved
where match.tournament_id = (select id from world_cup)
  and match.match_number = resolved.match_number
  and match.result_confirmed_at is null;
