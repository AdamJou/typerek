alter table public.matches
  add column if not exists advanced_team_id uuid;

alter table public.matches
  drop constraint if exists matches_advanced_team_fk;

alter table public.matches
  add constraint matches_advanced_team_fk
  foreign key (advanced_team_id, tournament_id)
  references public.teams(id, tournament_id);

alter table public.match_predictions
  add column if not exists predicted_advanced_team_id uuid references public.teams(id) on delete set null;

alter table public.score_breakdowns
  add column if not exists advancement_points integer not null default 0 check (advancement_points >= 0);

create index if not exists matches_advanced_team_idx
  on public.matches (advanced_team_id);

create index if not exists match_predictions_predicted_advanced_team_idx
  on public.match_predictions (predicted_advanced_team_id);

create table if not exists app_private.match_progression_routes (
  source_match_id uuid not null references public.matches(id) on delete cascade,
  outcome text not null check (outcome in ('winner', 'loser')),
  target_match_id uuid not null references public.matches(id) on delete cascade,
  target_slot text not null check (target_slot in ('home', 'away')),
  primary key (source_match_id, outcome),
  unique (target_match_id, target_slot),
  check (source_match_id <> target_match_id)
);

with route_numbers(source_match_number, outcome, target_match_number, target_slot) as (
  values
    (74, 'winner', 89, 'home'),
    (77, 'winner', 89, 'away'),
    (73, 'winner', 90, 'home'),
    (75, 'winner', 90, 'away'),
    (76, 'winner', 91, 'home'),
    (78, 'winner', 91, 'away'),
    (79, 'winner', 92, 'home'),
    (80, 'winner', 92, 'away'),
    (83, 'winner', 93, 'home'),
    (84, 'winner', 93, 'away'),
    (81, 'winner', 94, 'home'),
    (82, 'winner', 94, 'away'),
    (86, 'winner', 95, 'home'),
    (88, 'winner', 95, 'away'),
    (85, 'winner', 96, 'home'),
    (87, 'winner', 96, 'away'),
    (89, 'winner', 97, 'home'),
    (90, 'winner', 97, 'away'),
    (93, 'winner', 98, 'home'),
    (94, 'winner', 98, 'away'),
    (91, 'winner', 99, 'home'),
    (92, 'winner', 99, 'away'),
    (95, 'winner', 100, 'home'),
    (96, 'winner', 100, 'away'),
    (97, 'winner', 101, 'home'),
    (98, 'winner', 101, 'away'),
    (99, 'winner', 102, 'home'),
    (100, 'winner', 102, 'away'),
    (101, 'winner', 104, 'home'),
    (102, 'winner', 104, 'away'),
    (101, 'loser', 103, 'home'),
    (102, 'loser', 103, 'away')
),
world_cup as (
  select id
  from public.tournaments
  where slug = 'world-cup-2026'
),
resolved as (
  select
    source_match.id as source_match_id,
    route.outcome,
    target_match.id as target_match_id,
    route.target_slot
  from route_numbers route
  cross join world_cup tournament
  join public.matches source_match
    on source_match.tournament_id = tournament.id
   and source_match.match_number = route.source_match_number
  join public.matches target_match
    on target_match.tournament_id = tournament.id
   and target_match.match_number = route.target_match_number
)
insert into app_private.match_progression_routes (
  source_match_id,
  outcome,
  target_match_id,
  target_slot
)
select
  source_match_id,
  outcome,
  target_match_id,
  target_slot
from resolved
on conflict (source_match_id, outcome)
do update set
  target_match_id = excluded.target_match_id,
  target_slot = excluded.target_slot;

drop function if exists public.upsert_match_prediction(uuid, integer, integer, uuid, boolean);

create function public.upsert_match_prediction(
  p_match_id uuid,
  p_predicted_home_score integer,
  p_predicted_away_score integer,
  p_first_scorer_player_id uuid default null,
  p_no_scorer boolean default false,
  p_predicted_advanced_team_id uuid default null
)
returns public.match_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.matches;
  v_stage_code text;
  v_league_id uuid;
  v_prediction public.match_predictions;
  v_predicted_advanced_team_id uuid;
  v_is_knockout boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_predicted_home_score < 0 or p_predicted_away_score < 0 then
    raise exception 'invalid_score';
  end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for share;

  if not found then
    raise exception 'match_not_found';
  end if;

  select code into v_stage_code
  from public.tournament_stages
  where id = v_match.stage_id;

  v_is_knockout := v_stage_code in (
    'round_of_32',
    'round_of_16',
    'quarter_finals',
    'semi_finals',
    'third_place',
    'final'
  );

  if clock_timestamp() >= v_match.starts_at_utc then
    raise exception 'prediction_locked';
  end if;

  if p_no_scorer and (p_predicted_home_score <> 0 or p_predicted_away_score <> 0) then
    raise exception 'no_scorer_requires_zero_zero';
  end if;

  if not p_no_scorer and p_first_scorer_player_id is null then
    raise exception 'first_scorer_required';
  end if;

  if p_first_scorer_player_id is not null and not exists (
    select 1
    from public.players
    where id = p_first_scorer_player_id
      and team_id in (v_match.home_team_id, v_match.away_team_id)
      and active = true
  ) then
    raise exception 'first_scorer_not_in_match';
  end if;

  if v_is_knockout then
    if v_match.home_team_id is null or v_match.away_team_id is null then
      raise exception 'match_teams_required';
    end if;

    if p_predicted_home_score = p_predicted_away_score then
      if p_predicted_advanced_team_id is null then
        raise exception 'predicted_advanced_team_required';
      end if;

      if p_predicted_advanced_team_id not in (v_match.home_team_id, v_match.away_team_id) then
        raise exception 'predicted_advanced_team_not_in_match';
      end if;

      v_predicted_advanced_team_id := p_predicted_advanced_team_id;
    elsif p_predicted_home_score > p_predicted_away_score then
      v_predicted_advanced_team_id := v_match.home_team_id;
    else
      v_predicted_advanced_team_id := v_match.away_team_id;
    end if;
  else
    v_predicted_advanced_team_id := null;
  end if;

  select lm.league_id
  into v_league_id
  from public.league_members lm
  join public.leagues league on league.id = lm.league_id
  where lm.user_id = v_user_id
    and lm.status = 'active'
    and league.tournament_id = v_match.tournament_id
  limit 1;

  if v_league_id is null then
    raise exception 'league_membership_required';
  end if;

  insert into public.match_predictions (
    league_id,
    user_id,
    match_id,
    predicted_home_score,
    predicted_away_score,
    first_scorer_player_id,
    no_scorer,
    predicted_advanced_team_id,
    updated_at
  )
  values (
    v_league_id,
    v_user_id,
    p_match_id,
    p_predicted_home_score,
    p_predicted_away_score,
    case when p_no_scorer then null else p_first_scorer_player_id end,
    p_no_scorer,
    v_predicted_advanced_team_id,
    now()
  )
  on conflict (league_id, user_id, match_id)
  do update set
    predicted_home_score = excluded.predicted_home_score,
    predicted_away_score = excluded.predicted_away_score,
    first_scorer_player_id = excluded.first_scorer_player_id,
    no_scorer = excluded.no_scorer,
    predicted_advanced_team_id = excluded.predicted_advanced_team_id,
    updated_at = now()
  returning * into v_prediction;

  return v_prediction;
end;
$$;

revoke all on function public.upsert_match_prediction(uuid, integer, integer, uuid, boolean, uuid) from public;
grant execute on function public.upsert_match_prediction(uuid, integer, integer, uuid, boolean, uuid) to authenticated;

create or replace function app_private.apply_match_progression(
  p_source_match_id uuid,
  p_outcome text,
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_route app_private.match_progression_routes;
  v_target public.matches;
  v_current_team_id uuid;
begin
  select * into v_route
  from app_private.match_progression_routes
  where source_match_id = p_source_match_id
    and outcome = p_outcome;

  if not found then
    return;
  end if;

  select * into v_target
  from public.matches
  where id = v_route.target_match_id
  for update;

  if v_target.result_confirmed_at is not null then
    raise exception 'progression_target_already_confirmed';
  end if;

  v_current_team_id := case
    when v_route.target_slot = 'home' then v_target.home_team_id
    else v_target.away_team_id
  end;

  if v_current_team_id is distinct from p_team_id
    and exists (
      select 1
      from public.match_predictions
      where match_id = v_target.id
    )
  then
    raise exception 'progression_target_has_predictions';
  end if;

  update public.matches
  set
    home_team_id = case when v_route.target_slot = 'home' then p_team_id else home_team_id end,
    away_team_id = case when v_route.target_slot = 'away' then p_team_id else away_team_id end,
    home_placeholder = case when v_route.target_slot = 'home' then null else home_placeholder end,
    away_placeholder = case when v_route.target_slot = 'away' then null else away_placeholder end,
    updated_at = now()
  where id = v_target.id;
end;
$$;

revoke all on function app_private.apply_match_progression(uuid, text, uuid) from public;

create or replace function public.recalculate_match_scores(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not public.is_app_admin() then
    raise exception 'admin_required';
  end if;

  with calculated as (
    select
      p.league_id,
      p.user_id,
      'match'::text as source_type,
      m.id as source_id,
      m.stage_id,
      case
        when sign(p.predicted_home_score - p.predicted_away_score) = sign(m.home_score_90 - m.away_score_90)
          then scoring.result_points
        else 0
      end as outcome_points,
      case
        when p.predicted_home_score = m.home_score_90 and p.predicted_away_score = m.away_score_90
          then scoring.exact_score_bonus
        else 0
      end as exact_score_points,
      case
        when p.no_scorer = true and m.home_score_90 = 0 and m.away_score_90 = 0
          then scoring.first_scorer_points
        when p.no_scorer = false
          and p.first_scorer_player_id is not null
          and exists (
            select 1
            from public.match_events event
            where event.match_id = m.id
              and event.event_type = 'goal'
              and event.player_id = p.first_scorer_player_id
              and coalesce(event.detail, '') not in ('manual_own_goal', 'own_goal')
          )
          then scoring.first_scorer_points
        when p.no_scorer = false
          and p.first_scorer_player_id is not null
          and p.first_scorer_player_id = m.first_scorer_player_id
          and not exists (
            select 1
            from public.match_events event
            where event.match_id = m.id
              and event.event_type = 'goal'
              and coalesce(event.detail, '') not in ('manual_own_goal', 'own_goal')
          )
          then scoring.first_scorer_points
        else 0
      end as first_scorer_points,
      case
        when p.no_scorer = true and m.home_score_90 = 0 and m.away_score_90 = 0
          then 2
        when p.no_scorer = false
          and p.first_scorer_player_id is not null
          and p.first_scorer_player_id = coalesce(
            (
              select event.player_id
              from public.match_events event
              where event.match_id = m.id
                and event.event_type = 'goal'
                and event.player_id is not null
                and coalesce(event.detail, '') not in ('manual_own_goal', 'own_goal')
              order by event.minute, event.created_at, event.id
              limit 1
            ),
            m.first_scorer_player_id
          )
          then 2
        else 0
      end as bonus_points,
      case
        when m.advanced_team_id is null then 0
        when p.predicted_home_score = p.predicted_away_score
          and p.predicted_advanced_team_id = m.advanced_team_id
          then case when m.home_score_90 = m.away_score_90 then 2 else 1 end
        when p.predicted_home_score <> p.predicted_away_score
          and m.home_score_90 = m.away_score_90
          and case
            when p.predicted_home_score > p.predicted_away_score then m.home_team_id
            else m.away_team_id
          end = m.advanced_team_id
          then 1
        else 0
      end as advancement_points
    from public.match_predictions p
    join public.matches m on m.id = p.match_id
    join lateral (
      select *
      from public.scoring_rules rule
      where rule.league_id = p.league_id
        and rule.active = true
      order by rule.created_at desc
      limit 1
    ) scoring on true
    where m.id = p_match_id
      and m.result_confirmed_at is not null
      and m.home_score_90 is not null
      and m.away_score_90 is not null
  )
  insert into public.score_breakdowns (
    league_id,
    user_id,
    source_type,
    source_id,
    stage_id,
    outcome_points,
    exact_score_points,
    first_scorer_points,
    advancement_points,
    bonus_points,
    total_points,
    calculated_at
  )
  select
    league_id,
    user_id,
    source_type,
    source_id,
    stage_id,
    outcome_points,
    exact_score_points,
    first_scorer_points,
    advancement_points,
    bonus_points,
    outcome_points + exact_score_points + first_scorer_points + bonus_points + advancement_points,
    now()
  from calculated
  on conflict (league_id, user_id, source_type, source_id)
  do update set
    stage_id = excluded.stage_id,
    outcome_points = excluded.outcome_points,
    exact_score_points = excluded.exact_score_points,
    first_scorer_points = excluded.first_scorer_points,
    advancement_points = excluded.advancement_points,
    bonus_points = excluded.bonus_points,
    total_points = excluded.total_points,
    calculated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.recalculate_match_scores(uuid) from public;
grant execute on function public.recalculate_match_scores(uuid) to authenticated;

create or replace function public.set_match_result_with_advancement(
  p_match_id uuid,
  p_home_score_90 integer,
  p_away_score_90 integer,
  p_first_scorer_player_id uuid default null,
  p_no_scorer_confirmed boolean default false,
  p_scorers jsonb default '[]'::jsonb,
  p_advanced_team_id uuid default null,
  p_reason text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.matches;
  v_stage_code text;
  v_is_knockout boolean;
  v_losing_team_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'admin_required';
  end if;

  select stage.code into v_stage_code
  from public.matches match
  join public.tournament_stages stage on stage.id = match.stage_id
  where match.id = p_match_id;

  if not found then
    raise exception 'match_not_found';
  end if;

  v_is_knockout := v_stage_code in (
    'round_of_32',
    'round_of_16',
    'quarter_finals',
    'semi_finals',
    'third_place',
    'final'
  );

  if v_is_knockout and p_advanced_team_id is null then
    raise exception 'advanced_team_required';
  end if;

  v_match := public.set_match_result_with_events(
    p_match_id,
    p_home_score_90,
    p_away_score_90,
    p_first_scorer_player_id,
    p_no_scorer_confirmed,
    p_scorers,
    p_reason
  );

  if not v_is_knockout then
    return v_match;
  end if;

  if p_advanced_team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'advanced_team_not_in_match';
  end if;

  if p_home_score_90 > p_away_score_90
    and p_advanced_team_id <> v_match.home_team_id
  then
    raise exception 'advanced_team_conflicts_with_score';
  end if;

  if p_away_score_90 > p_home_score_90
    and p_advanced_team_id <> v_match.away_team_id
  then
    raise exception 'advanced_team_conflicts_with_score';
  end if;

  v_losing_team_id := case
    when p_advanced_team_id = v_match.home_team_id then v_match.away_team_id
    else v_match.home_team_id
  end;

  update public.matches
  set
    advanced_team_id = p_advanced_team_id,
    updated_at = now()
  where id = p_match_id
  returning * into v_match;

  perform app_private.apply_match_progression(p_match_id, 'winner', p_advanced_team_id);
  perform app_private.apply_match_progression(p_match_id, 'loser', v_losing_team_id);

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    after_data,
    reason
  )
  values (
    v_user_id,
    'set_match_advancement',
    'matches',
    p_match_id,
    jsonb_build_object(
      'advanced_team_id', p_advanced_team_id,
      'losing_team_id', v_losing_team_id
    ),
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  perform public.recalculate_match_scores(p_match_id);

  return v_match;
end;
$$;

revoke all on function public.set_match_result_with_advancement(uuid, integer, integer, uuid, boolean, jsonb, uuid, text) from public;
grant execute on function public.set_match_result_with_advancement(uuid, integer, integer, uuid, boolean, jsonb, uuid, text) to authenticated;
