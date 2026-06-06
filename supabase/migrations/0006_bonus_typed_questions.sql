alter table public.bonus_questions
  add column if not exists slug text,
  add column if not exists kind text,
  add column if not exists source_kind text,
  add column if not exists config_json jsonb not null default '{}'::jsonb,
  add column if not exists lock_at timestamptz,
  add column if not exists display_order integer;

update public.bonus_questions
set
  lock_at = coalesce(lock_at, deadline_at),
  display_order = coalesce(
    display_order,
    ranked.question_order
  )
from (
  select
    id,
    row_number() over (order by deadline_at asc, created_at asc, title asc) as question_order
  from public.bonus_questions
) ranked
where ranked.id = bonus_questions.id;

create unique index if not exists bonus_questions_slug_idx
  on public.bonus_questions (league_id, slug)
  where slug is not null;

alter table public.bonus_predictions
  add column if not exists answer_json jsonb;

update public.bonus_predictions
set answer_json = coalesce(answer_json, jsonb_build_object('optionId', option_id))
where answer_json is null;

alter table public.bonus_predictions
  alter column option_id drop not null;

create table if not exists public.bonus_resolution_facts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  question_slug text,
  fact_key text not null,
  fact_value jsonb not null default '{}'::jsonb,
  source_kind text not null default 'manual',
  source_status text not null default 'pending'
    check (source_status in ('pending', 'resolved', 'missing_data')),
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bonus_resolution_facts_league_idx
  on public.bonus_resolution_facts (league_id, question_slug);

create table if not exists public.bonus_question_resolutions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.bonus_questions(id) on delete cascade,
  answer_json jsonb,
  source_snapshot_json jsonb,
  source_status text not null default 'manual'
    check (source_status in ('auto', 'partial', 'manual')),
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'manual_override', 'missing_data')),
  note text,
  updated_at timestamptz not null default now()
);

create index if not exists bonus_question_resolutions_status_idx
  on public.bonus_question_resolutions (status, source_status);

alter table public.bonus_resolution_facts enable row level security;
alter table public.bonus_question_resolutions enable row level security;

create policy bonus_resolution_facts_read_admin on public.bonus_resolution_facts
  for select to authenticated
  using (public.is_app_admin() or public.is_league_admin(league_id));

create policy bonus_question_resolutions_read_admin on public.bonus_question_resolutions
  for select to authenticated
  using (
    exists (
      select 1
      from public.bonus_questions q
      where q.id = bonus_question_resolutions.question_id
        and (public.is_app_admin() or public.is_league_admin(q.league_id))
    )
  );

create or replace function public.delete_bonus_prediction(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_question public.bonus_questions;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_question
  from public.bonus_questions
  where id = p_question_id
  for share;

  if not found then
    raise exception 'bonus_question_not_found';
  end if;

  if clock_timestamp() >= coalesce(v_question.lock_at, v_question.deadline_at) then
    raise exception 'bonus_prediction_locked';
  end if;

  if not public.is_league_member(v_question.league_id) then
    raise exception 'league_membership_required';
  end if;

  delete from public.bonus_predictions
  where question_id = p_question_id
    and user_id = v_user_id;
end;
$$;

create or replace function public.upsert_bonus_prediction(p_question_id uuid, p_answer_json jsonb)
returns public.bonus_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_question public.bonus_questions;
  v_prediction public.bonus_predictions;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_question
  from public.bonus_questions
  where id = p_question_id
  for share;

  if not found then
    raise exception 'bonus_question_not_found';
  end if;

  if clock_timestamp() >= coalesce(v_question.lock_at, v_question.deadline_at) then
    raise exception 'bonus_prediction_locked';
  end if;

  if not public.is_league_member(v_question.league_id) then
    raise exception 'league_membership_required';
  end if;

  insert into public.bonus_predictions (question_id, user_id, answer_json, updated_at)
  values (p_question_id, v_user_id, p_answer_json, now())
  on conflict (question_id, user_id)
  do update set
    answer_json = excluded.answer_json,
    updated_at = now()
  returning * into v_prediction;

  return v_prediction;
end;
$$;

create or replace function public.calculate_bonus_group_score(p_prediction jsonb, p_resolution jsonb)
returns integer
language plpgsql
immutable
as $$
declare
  v_group jsonb;
  v_actual_group jsonb;
  v_predicted_ids text[];
  v_actual_ids text[];
  v_group_score integer := 0;
  v_position integer;
begin
  if p_prediction is null or p_resolution is null then
    return 0;
  end if;

  for v_group in
    select value
    from jsonb_array_elements(coalesce(p_prediction -> 'groups', '[]'::jsonb))
  loop
    select value
    into v_actual_group
    from jsonb_array_elements(coalesce(p_resolution -> 'groups', '[]'::jsonb))
    where value ->> 'groupCode' = v_group ->> 'groupCode'
    limit 1;

    if v_actual_group is null then
      continue;
    end if;

    select coalesce(array_agg(value order by ordinality), '{}')
    into v_predicted_ids
    from jsonb_array_elements_text(coalesce(v_group -> 'orderedTeamIds', '[]'::jsonb)) with ordinality as predicted(value, ordinality);

    select coalesce(array_agg(value order by ordinality), '{}')
    into v_actual_ids
    from jsonb_array_elements_text(coalesce(v_actual_group -> 'orderedTeamIds', '[]'::jsonb)) with ordinality as actual(value, ordinality);

    for v_position in 1..least(coalesce(array_length(v_predicted_ids, 1), 0), coalesce(array_length(v_actual_ids, 1), 0)) loop
      if v_predicted_ids[v_position] = v_actual_ids[v_position] then
        v_group_score := v_group_score + 2;
      end if;
    end loop;

    if v_predicted_ids = v_actual_ids then
      v_group_score := v_group_score + 10;
    end if;
  end loop;

  return v_group_score;
end;
$$;

create or replace function public.calculate_bonus_points(
  p_kind text,
  p_points integer,
  p_prediction jsonb,
  p_resolution jsonb
)
returns integer
language plpgsql
immutable
as $$
begin
  if p_prediction is null or p_resolution is null then
    return 0;
  end if;

  case p_kind
    when 'boolean', 'numeric', 'player_numeric', 'team_numeric' then
      return case when p_prediction -> 'value' = p_resolution -> 'value' then p_points else 0 end;
    when 'team_single' then
      return case when p_prediction ->> 'teamId' = p_resolution ->> 'teamId' then p_points else 0 end;
    when 'player_single' then
      return case when p_prediction ->> 'playerId' = p_resolution ->> 'playerId' then p_points else 0 end;
    when 'team_stage_exit' then
      return case when p_prediction ->> 'stageCode' = p_resolution ->> 'stageCode' then p_points else 0 end;
    when 'duel_player', 'duel_team', 'comparison_numeric' then
      return case when p_prediction ->> 'winnerKey' = p_resolution ->> 'winnerKey' then p_points else 0 end;
    when 'ranked_top4' then
      return case when coalesce(p_prediction -> 'orderedTeamIds', '[]'::jsonb) = coalesce(p_resolution -> 'orderedTeamIds', '[]'::jsonb) then p_points else 0 end;
    when 'ranked_group_table' then
      return public.calculate_bonus_group_score(p_prediction, p_resolution);
    else
      return case when p_prediction = p_resolution then p_points else 0 end;
  end case;
end;
$$;

create or replace function public.recalculate_bonus_scores(p_question_id uuid)
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

  insert into public.score_breakdowns (
    league_id,
    user_id,
    source_type,
    source_id,
    stage_id,
    outcome_points,
    exact_score_points,
    first_scorer_points,
    bonus_points,
    total_points,
    calculated_at
  )
  select
    q.league_id,
    bp.user_id,
    'bonus',
    q.id,
    null,
    0,
    0,
    0,
    public.calculate_bonus_points(
      coalesce(q.kind, 'numeric'),
      q.points,
      bp.answer_json,
      r.answer_json
    ),
    public.calculate_bonus_points(
      coalesce(q.kind, 'numeric'),
      q.points,
      bp.answer_json,
      r.answer_json
    ),
    now()
  from public.bonus_predictions bp
  join public.bonus_questions q on q.id = bp.question_id
  join public.bonus_question_resolutions r on r.question_id = q.id
  where q.id = p_question_id
    and r.status in ('resolved', 'manual_override')
  on conflict (league_id, user_id, source_type, source_id)
  do update set
    bonus_points = excluded.bonus_points,
    total_points = excluded.total_points,
    calculated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.recalculate_league_scores(p_league_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_question_id uuid;
  v_total integer := 0;
begin
  if not public.is_app_admin() then
    raise exception 'admin_required';
  end if;

  for v_match_id in
    select distinct p.match_id
    from public.match_predictions p
    join public.matches m on m.id = p.match_id
    where p.league_id = p_league_id
      and m.result_confirmed_at is not null
  loop
    v_total := v_total + public.recalculate_match_scores(v_match_id);
  end loop;

  for v_question_id in
    select q.id
    from public.bonus_questions q
    join public.bonus_question_resolutions r on r.question_id = q.id
    where q.league_id = p_league_id
      and r.status in ('resolved', 'manual_override')
  loop
    v_total := v_total + public.recalculate_bonus_scores(v_question_id);
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.upsert_bonus_prediction(uuid, jsonb) from public;
grant execute on function public.upsert_bonus_prediction(uuid, jsonb) to authenticated;
revoke execute on function public.delete_bonus_prediction(uuid) from public;
grant execute on function public.delete_bonus_prediction(uuid) to authenticated;
revoke execute on function public.calculate_bonus_group_score(jsonb, jsonb) from public;
revoke execute on function public.calculate_bonus_points(text, integer, jsonb, jsonb) from public;

grant select on table public.bonus_resolution_facts to authenticated;
grant select on table public.bonus_question_resolutions to authenticated;
