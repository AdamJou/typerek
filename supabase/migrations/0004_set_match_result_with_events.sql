create or replace function public.set_match_result_with_events(
  p_match_id uuid,
  p_home_score_90 integer,
  p_away_score_90 integer,
  p_first_scorer_player_id uuid default null,
  p_no_scorer_confirmed boolean default false,
  p_scorers jsonb default '[]'::jsonb,
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
  v_total_goals integer := p_home_score_90 + p_away_score_90;
  v_scorer_count integer := 0;
  v_home_goal_count integer := 0;
  v_away_goal_count integer := 0;
  v_first_scorer_player_id uuid := null;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'admin_required';
  end if;

  if p_home_score_90 < 0 or p_away_score_90 < 0 then
    raise exception 'invalid_score';
  end if;

  if jsonb_typeof(coalesce(p_scorers, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_goal_scorer';
  end if;

  select * into v_before from public.matches where id = p_match_id for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  with scorer_rows as (
    select
      nullif(item.value->>'teamId', '')::uuid as team_id,
      nullif(item.value->>'playerId', '')::uuid as player_id,
      coalesce((item.value->>'ownGoal')::boolean, false) as own_goal
    from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) with ordinality as item(value, sort_order)
  )
  select
    count(*)::integer,
    count(*) filter (where team_id = v_before.home_team_id)::integer,
    count(*) filter (where team_id = v_before.away_team_id)::integer
  into v_scorer_count, v_home_goal_count, v_away_goal_count
  from scorer_rows;

  if v_total_goals = 0 then
    if not p_no_scorer_confirmed or v_scorer_count > 0 then
      raise exception 'no_scorer_requires_zero_zero';
    end if;
  else
    if p_no_scorer_confirmed or v_scorer_count <> v_total_goals then
      raise exception 'goal_count_mismatch';
    end if;

    if v_home_goal_count <> p_home_score_90 or v_away_goal_count <> p_away_score_90 then
      raise exception 'goal_team_count_mismatch';
    end if;

    if exists (
      with scorer_rows as (
        select
          nullif(item.value->>'teamId', '')::uuid as team_id,
          nullif(item.value->>'playerId', '')::uuid as player_id
        from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) with ordinality as item(value, sort_order)
      )
      select 1
      from scorer_rows
      where player_id is null
        or team_id not in (v_before.home_team_id, v_before.away_team_id)
    ) then
      raise exception 'invalid_goal_scorer';
    end if;

    if exists (
      with scorer_rows as (
        select
          nullif(item.value->>'teamId', '')::uuid as team_id,
          nullif(item.value->>'playerId', '')::uuid as player_id,
          coalesce((item.value->>'ownGoal')::boolean, false) as own_goal
        from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) with ordinality as item(value, sort_order)
      )
      select 1
      from scorer_rows sr
      left join public.players p on p.id = sr.player_id
      where p.id is null
        or p.team_id not in (v_before.home_team_id, v_before.away_team_id)
    ) then
      raise exception 'first_scorer_not_in_match';
    end if;

    if exists (
      with scorer_rows as (
        select
          nullif(item.value->>'teamId', '')::uuid as team_id,
          nullif(item.value->>'playerId', '')::uuid as player_id,
          coalesce((item.value->>'ownGoal')::boolean, false) as own_goal
        from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) with ordinality as item(value, sort_order)
      )
      select 1
      from scorer_rows sr
      join public.players p on p.id = sr.player_id
      where not sr.own_goal
        and p.team_id <> sr.team_id
    ) then
      raise exception 'goal_player_team_mismatch';
    end if;

    if exists (
      with scorer_rows as (
        select
          nullif(item.value->>'teamId', '')::uuid as team_id,
          nullif(item.value->>'playerId', '')::uuid as player_id,
          coalesce((item.value->>'ownGoal')::boolean, false) as own_goal
        from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) with ordinality as item(value, sort_order)
      )
      select 1
      from scorer_rows sr
      join public.players p on p.id = sr.player_id
      where sr.own_goal
        and p.team_id <> case
          when sr.team_id = v_before.home_team_id then v_before.away_team_id
          else v_before.home_team_id
        end
    ) then
      raise exception 'own_goal_player_team_mismatch';
    end if;

    select player_id into v_first_scorer_player_id
    from (
      select
        nullif(item.value->>'playerId', '')::uuid as player_id,
        coalesce((item.value->>'ownGoal')::boolean, false) as own_goal,
        item.sort_order
      from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) with ordinality as item(value, sort_order)
    ) scorer_rows
    where not own_goal
    order by sort_order
    limit 1;
  end if;

  if v_first_scorer_player_id is not null and not exists (
    select 1
    from public.players
    where id = v_first_scorer_player_id
      and team_id in (v_before.home_team_id, v_before.away_team_id)
  ) then
    raise exception 'first_scorer_not_in_match';
  end if;

  update public.matches
  set
    home_score_90 = p_home_score_90,
    away_score_90 = p_away_score_90,
    first_scorer_player_id = case when p_no_scorer_confirmed then null else v_first_scorer_player_id end,
    no_scorer_confirmed = p_no_scorer_confirmed,
    status = 'confirmed',
    result_confirmed_at = now(),
    updated_at = now()
  where id = p_match_id
  returning * into v_after;

  delete from public.match_events
  where match_id = p_match_id
    and provider = 'manual';

  if v_total_goals > 0 then
    insert into public.match_events (
      match_id,
      provider,
      provider_event_id,
      event_type,
      minute,
      extra_minute,
      team_id,
      player_id,
      player_name,
      detail
    )
    select
      p_match_id,
      'manual',
      'manual-goal-' || item.sort_order,
      'goal',
      item.sort_order::integer,
      null,
      nullif(item.value->>'teamId', '')::uuid,
      p.id,
      p.name,
      case when coalesce((item.value->>'ownGoal')::boolean, false) then 'manual_own_goal' else 'manual_goal' end
    from jsonb_array_elements(coalesce(p_scorers, '[]'::jsonb)) with ordinality as item(value, sort_order)
    join public.players p on p.id = nullif(item.value->>'playerId', '')::uuid
    order by item.sort_order;
  elsif p_no_scorer_confirmed then
    insert into public.match_events (
      match_id,
      provider,
      provider_event_id,
      event_type,
      minute,
      extra_minute,
      team_id,
      player_id,
      player_name,
      detail
    )
    values (
      p_match_id,
      'manual',
      'manual-no-goal',
      'no_goal',
      0,
      null,
      null,
      null,
      null,
      'manual_no_goal'
    );
  end if;

  insert into public.admin_audit_logs (actor_user_id, action, entity_table, entity_id, before_data, after_data, reason)
  values (v_user_id, 'set_match_result_with_events', 'matches', p_match_id, to_jsonb(v_before), to_jsonb(v_after), p_reason);

  perform public.recalculate_match_scores(p_match_id);

  return v_after;
end;
$$;

grant execute on function public.set_match_result_with_events(uuid, integer, integer, uuid, boolean, jsonb, text) to authenticated;
