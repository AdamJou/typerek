create or replace function public.normalize_bonus_question_display_order(p_league_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      id,
      row_number() over (
        order by coalesce(display_order, 2147483647), deadline_at asc, created_at asc, title asc
      ) as next_display_order
    from public.bonus_questions
    where league_id = p_league_id
  )
  update public.bonus_questions as question
  set
    display_order = ranked.next_display_order,
    updated_at = case
      when question.display_order is distinct from ranked.next_display_order then now()
      else question.updated_at
    end
  from ranked
  where ranked.id = question.id;
$$;

create or replace function public.create_bonus_question_admin(
  p_league_id uuid,
  p_title text,
  p_points integer,
  p_deadline_at timestamptz,
  p_lock_at timestamptz default null,
  p_display_order integer default null,
  p_slug text default null,
  p_kind text default 'numeric',
  p_source_kind text default 'manual_fact',
  p_config_json jsonb default '{}'::jsonb
)
returns public.bonus_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_slug text := nullif(btrim(coalesce(p_slug, '')), '');
  v_question public.bonus_questions;
  v_display_order integer;
  v_allowed_kinds constant text[] := array[
    'player_numeric',
    'team_numeric',
    'team_single',
    'team_stage_exit',
    'player_single',
    'boolean',
    'numeric',
    'duel_player',
    'duel_team',
    'ranked_top4',
    'ranked_group_table',
    'comparison_numeric'
  ];
  v_allowed_source_kinds constant text[] := array[
    'fixed_player',
    'fixed_team',
    'players',
    'goalkeepers',
    'teams',
    'host_teams',
    'team_stages',
    'duel_players',
    'duel_teams',
    'comparison_options',
    'group_teams',
    'manual_fact',
    'tournament_fact'
  ];
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not (public.is_app_admin() or public.is_league_admin(p_league_id)) then
    raise exception 'admin_required';
  end if;

  if v_title = '' then
    raise exception 'bonus_question_title_required';
  end if;

  if p_points is null or p_points < 0 then
    raise exception 'bonus_question_points_invalid';
  end if;

  if p_deadline_at is null then
    raise exception 'bonus_question_deadline_required';
  end if;

  if p_kind is null or not (p_kind = any(v_allowed_kinds)) then
    raise exception 'bonus_question_kind_invalid';
  end if;

  if p_source_kind is null or not (p_source_kind = any(v_allowed_source_kinds)) then
    raise exception 'bonus_question_source_kind_invalid';
  end if;

  select coalesce(max(display_order), 0) + 1
  into v_display_order
  from public.bonus_questions
  where league_id = p_league_id;

  v_display_order := greatest(1, coalesce(p_display_order, v_display_order));

  insert into public.bonus_questions (
    league_id,
    title,
    points,
    deadline_at,
    lock_at,
    display_order,
    slug,
    kind,
    source_kind,
    config_json,
    created_by
  )
  values (
    p_league_id,
    v_title,
    p_points,
    p_deadline_at,
    coalesce(p_lock_at, p_deadline_at),
    v_display_order,
    v_slug,
    p_kind,
    p_source_kind,
    coalesce(p_config_json, '{}'::jsonb),
    v_user_id
  )
  returning * into v_question;

  perform public.normalize_bonus_question_display_order(p_league_id);

  select *
  into v_question
  from public.bonus_questions
  where id = v_question.id;

  return v_question;
end;
$$;

create or replace function public.delete_bonus_question_admin(p_question_id uuid)
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
  for update;

  if not found then
    raise exception 'bonus_question_not_found';
  end if;

  if not (public.is_app_admin() or public.is_league_admin(v_question.league_id)) then
    raise exception 'admin_required';
  end if;

  delete from public.score_breakdowns
  where source_type = 'bonus'
    and source_id = p_question_id;

  if v_question.slug is not null then
    delete from public.bonus_resolution_facts
    where league_id = v_question.league_id
      and question_slug = v_question.slug;
  end if;

  delete from public.bonus_questions
  where id = p_question_id;

  perform public.normalize_bonus_question_display_order(v_question.league_id);
end;
$$;

revoke execute on function public.normalize_bonus_question_display_order(uuid) from public;
revoke execute on function public.create_bonus_question_admin(uuid, text, integer, timestamptz, timestamptz, integer, text, text, text, jsonb) from public;
grant execute on function public.create_bonus_question_admin(uuid, text, integer, timestamptz, timestamptz, integer, text, text, text, jsonb) to authenticated;
revoke execute on function public.delete_bonus_question_admin(uuid) from public;
grant execute on function public.delete_bonus_question_admin(uuid) to authenticated;