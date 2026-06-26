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
          then sr.result_points
        else 0
      end as outcome_points,
      case
        when p.predicted_home_score = m.home_score_90 and p.predicted_away_score = m.away_score_90
          then sr.exact_score_bonus
        else 0
      end as exact_score_points,
      case
        when p.no_scorer = true and m.home_score_90 = 0 and m.away_score_90 = 0
          then sr.first_scorer_points
        when p.no_scorer = false
          and p.first_scorer_player_id is not null
          and exists (
            select 1
            from public.match_events me
            where me.match_id = m.id
              and me.event_type = 'goal'
              and me.player_id = p.first_scorer_player_id
              and coalesce(me.detail, '') not in ('manual_own_goal', 'own_goal')
          )
          then sr.first_scorer_points
        when p.no_scorer = false
          and p.first_scorer_player_id is not null
          and p.first_scorer_player_id = m.first_scorer_player_id
          and not exists (
            select 1
            from public.match_events me
            where me.match_id = m.id
              and me.event_type = 'goal'
              and coalesce(me.detail, '') not in ('manual_own_goal', 'own_goal')
          )
          then sr.first_scorer_points
        else 0
      end as first_scorer_points,
      case
        when p.no_scorer = true and m.home_score_90 = 0 and m.away_score_90 = 0
          then 2
        when p.no_scorer = false
          and p.first_scorer_player_id is not null
          and p.first_scorer_player_id = coalesce(
            (
              select me.player_id
              from public.match_events me
              where me.match_id = m.id
                and me.event_type = 'goal'
                and me.player_id is not null
                and coalesce(me.detail, '') not in ('manual_own_goal', 'own_goal')
              order by me.minute, me.created_at, me.id
              limit 1
            ),
            m.first_scorer_player_id
          )
          then 2
        else 0
      end as bonus_points
    from public.match_predictions p
    join public.matches m on m.id = p.match_id
    join lateral (
      select *
      from public.scoring_rules r
      where r.league_id = p.league_id
        and r.active = true
      order by r.created_at desc
      limit 1
    ) sr on true
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
    bonus_points,
    outcome_points + exact_score_points + first_scorer_points + bonus_points,
    now()
  from calculated
  on conflict (league_id, user_id, source_type, source_id)
  do update set
    stage_id = excluded.stage_id,
    outcome_points = excluded.outcome_points,
    exact_score_points = excluded.exact_score_points,
    first_scorer_points = excluded.first_scorer_points,
    bonus_points = excluded.bonus_points,
    total_points = excluded.total_points,
    calculated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.recalculate_match_scores(uuid) to authenticated;

with calculated as (
  select
    p.league_id,
    p.user_id,
    'match'::text as source_type,
    m.id as source_id,
    m.stage_id,
    case
      when sign(p.predicted_home_score - p.predicted_away_score) = sign(m.home_score_90 - m.away_score_90)
        then sr.result_points
      else 0
    end as outcome_points,
    case
      when p.predicted_home_score = m.home_score_90 and p.predicted_away_score = m.away_score_90
        then sr.exact_score_bonus
      else 0
    end as exact_score_points,
    case
      when p.no_scorer = true and m.home_score_90 = 0 and m.away_score_90 = 0
        then sr.first_scorer_points
      when p.no_scorer = false
        and p.first_scorer_player_id is not null
        and exists (
          select 1
          from public.match_events me
          where me.match_id = m.id
            and me.event_type = 'goal'
            and me.player_id = p.first_scorer_player_id
            and coalesce(me.detail, '') not in ('manual_own_goal', 'own_goal')
        )
        then sr.first_scorer_points
      when p.no_scorer = false
        and p.first_scorer_player_id is not null
        and p.first_scorer_player_id = m.first_scorer_player_id
        and not exists (
          select 1
          from public.match_events me
          where me.match_id = m.id
            and me.event_type = 'goal'
            and coalesce(me.detail, '') not in ('manual_own_goal', 'own_goal')
        )
        then sr.first_scorer_points
      else 0
    end as first_scorer_points,
    case
      when p.no_scorer = true and m.home_score_90 = 0 and m.away_score_90 = 0
        then 2
      when p.no_scorer = false
        and p.first_scorer_player_id is not null
        and p.first_scorer_player_id = coalesce(
          (
            select me.player_id
            from public.match_events me
            where me.match_id = m.id
              and me.event_type = 'goal'
              and me.player_id is not null
              and coalesce(me.detail, '') not in ('manual_own_goal', 'own_goal')
            order by me.minute, me.created_at, me.id
            limit 1
          ),
          m.first_scorer_player_id
        )
        then 2
      else 0
    end as bonus_points
  from public.match_predictions p
  join public.matches m on m.id = p.match_id
  join lateral (
    select *
    from public.scoring_rules r
    where r.league_id = p.league_id
      and r.active = true
    order by r.created_at desc
    limit 1
  ) sr on true
  where m.result_confirmed_at is not null
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
  bonus_points,
  outcome_points + exact_score_points + first_scorer_points + bonus_points,
  now()
from calculated
on conflict (league_id, user_id, source_type, source_id)
do update set
  stage_id = excluded.stage_id,
  outcome_points = excluded.outcome_points,
  exact_score_points = excluded.exact_score_points,
  first_scorer_points = excluded.first_scorer_points,
  bonus_points = excluded.bonus_points,
  total_points = excluded.total_points,
  calculated_at = now();
