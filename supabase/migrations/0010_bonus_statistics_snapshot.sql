create table if not exists public.league_bonus_statistics (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  generated_at timestamptz not null default now(),
  member_count integer not null check (member_count >= 0),
  statistics_json jsonb not null check (jsonb_typeof(statistics_json) = 'object')
);

comment on table public.league_bonus_statistics is
  'Immutable, one-time aggregate of locked bonus answers for a league.';

alter table public.league_bonus_statistics enable row level security;

revoke all on table public.league_bonus_statistics from public, anon, authenticated;
grant select on table public.league_bonus_statistics to authenticated;

drop policy if exists league_bonus_statistics_read_members on public.league_bonus_statistics;
create policy league_bonus_statistics_read_members
  on public.league_bonus_statistics
  for select
  to authenticated
  using (
    (select app_private.is_league_member(league_id))
    or (select app_private.is_league_admin(league_id))
  );

with selected_questions (
  logical_key,
  slugs,
  title_pattern,
  title_override,
  entity_type,
  metric,
  section,
  sort_order
) as (
  values
    ('q02-world-cup-winner', array['q02-world-cup-winner'], null, 'Faworyt ligi do mistrzostwa', 'team', 'answer', 'featured', 1),
    ('q24-top-four', array['q24-top-four'], null, 'Najczęściej wybierane drużyny w Top 4', 'team', 'top4_presence', 'featured', 2),
    ('q05-top-scorer', array['q05-top-scorer'], null, null, 'player', 'answer', 'awards', 10),
    ('tournament-mvp', array['q42-tournament-mvp', 'q43-tournament-mvp', 'q43-mvp'], '%mvp%', null, 'player', 'answer', 'awards', 11),
    ('q06-top-assists', array['q06-top-assists'], null, null, 'player', 'answer', 'awards', 12),
    ('q07-golden-glove', array['q07-golden-glove'], null, null, 'player', 'answer', 'awards', 13),
    ('q19-mbappe-vs-yamal', array['q19-mbappe-vs-yamal'], null, null, 'player', 'answer', 'duels', 20),
    ('q25-ronaldo-vs-messi-stage', array['q25-ronaldo-vs-messi-stage'], null, null, 'player', 'answer', 'duels', 21),
    ('q08-own-goals-vs-red-cards', array['q08-own-goals-vs-red-cards'], null, null, 'choice', 'answer', 'duels', 22),
    ('q34-kdb-vs-bfik-assists', array['q34-kdb-vs-bfik-assists'], null, null, 'player', 'answer', 'duels', 23),
    ('q37-japan-vs-korea', array['q37-japan-vs-korea'], null, null, 'team', 'answer', 'duels', 24),
    ('argentina-vs-belgium', array['q44-argentina-vs-belgium', 'q45-argentina-vs-belgium'], '%argent%belgi%', null, 'team', 'answer', 'duels', 25),
    ('q03-spain-exit-stage', array['q03-spain-exit-stage'], null, null, 'choice', 'answer', 'insights', 30),
    ('q14-brazil-past-quarter-finals', array['q14-brazil-past-quarter-finals'], null, null, 'choice', 'answer', 'insights', 31),
    ('q18-england-over-6-group-goals', array['q18-england-over-6-group-goals'], null, null, 'choice', 'answer', 'insights', 32),
    ('q21-african-teams-from-groups', array['q21-african-teams-from-groups'], null, null, 'choice', 'answer', 'insights', 33),
    ('q29-hosts-out-of-groups', array['q29-hosts-out-of-groups'], null, null, 'choice', 'answer', 'insights', 34),
    ('q30-host-longest-run', array['q30-host-longest-run'], null, null, 'team', 'answer', 'insights', 35)
),
eligible_questions as (
  select distinct on (question.league_id, selected.logical_key)
    question.id,
    question.league_id,
    coalesce(question.slug, selected.logical_key) as slug,
    coalesce(selected.title_override, question.title) as title,
    question.kind,
    selected.entity_type,
    selected.metric,
    selected.section,
    selected.sort_order
  from public.bonus_questions as question
  join lateral (
    select candidate.*
    from selected_questions as candidate
    where question.slug = any(candidate.slugs)
      or (
        candidate.title_pattern is not null
        and lower(question.title) like candidate.title_pattern
      )
    order by
      (question.slug = any(candidate.slugs)) desc,
      candidate.sort_order
    limit 1
  ) as selected on true
  where clock_timestamp() >= coalesce(question.lock_at, question.deadline_at)
  order by
    question.league_id,
    selected.logical_key,
    (question.slug = any(selected.slugs)) desc,
    question.display_order nulls last,
    question.id
),
active_members as (
  select
    member.league_id,
    member.user_id
  from public.league_members as member
  where member.status = 'active'
),
valid_predictions as (
  select
    question.id as question_id,
    question.league_id,
    question.slug,
    question.title,
    question.kind,
    question.entity_type,
    question.metric,
    question.section,
    question.sort_order,
    prediction.user_id,
    prediction.answer_json
  from eligible_questions as question
  join public.bonus_predictions as prediction
    on prediction.question_id = question.id
  join active_members as member
    on member.league_id = question.league_id
    and member.user_id = prediction.user_id
),
single_answer_rows as (
  select
    prediction.question_id,
    prediction.league_id,
    prediction.slug,
    prediction.title,
    prediction.entity_type,
    prediction.metric,
    prediction.section,
    prediction.sort_order,
    prediction.user_id,
    case
      when prediction.kind = 'team_single' then prediction.answer_json ->> 'teamId'
      when prediction.kind = 'player_single' then prediction.answer_json ->> 'playerId'
      when prediction.kind = 'team_stage_exit' then prediction.answer_json ->> 'stageCode'
      when prediction.kind in ('boolean', 'numeric', 'player_numeric', 'team_numeric')
        then prediction.answer_json ->> 'value'
      else prediction.answer_json ->> 'winnerKey'
    end as option_key,
    null::numeric as average_position
  from valid_predictions as prediction
  where prediction.metric = 'answer'
),
top_four_answer_rows as (
  select
    prediction.question_id,
    prediction.league_id,
    prediction.slug,
    prediction.title,
    prediction.entity_type,
    prediction.metric,
    prediction.section,
    prediction.sort_order,
    prediction.user_id,
    selected_team.option_key,
    min(selected_team.position)::numeric as average_position
  from valid_predictions as prediction
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(prediction.answer_json -> 'orderedTeamIds') = 'array'
        then prediction.answer_json -> 'orderedTeamIds'
      else '[]'::jsonb
    end
  ) with ordinality as selected_team(option_key, position)
  where prediction.metric = 'top4_presence'
    and case
      when jsonb_typeof(prediction.answer_json -> 'orderedTeamIds') = 'array'
        then jsonb_array_length(prediction.answer_json -> 'orderedTeamIds') = 4
      else false
    end
  group by
    prediction.question_id,
    prediction.league_id,
    prediction.slug,
    prediction.title,
    prediction.entity_type,
    prediction.metric,
    prediction.section,
    prediction.sort_order,
    prediction.user_id,
    selected_team.option_key
),
answer_rows as (
  select * from single_answer_rows
  union all
  select * from top_four_answer_rows
),
clean_answer_rows as (
  select *
  from answer_rows
  where nullif(btrim(option_key), '') is not null
),
question_totals as (
  select
    question_id,
    count(distinct user_id)::integer as respondent_count
  from clean_answer_rows
  group by question_id
),
option_counts as (
  select
    question_id,
    option_key,
    count(distinct user_id)::integer as answer_count,
    round(avg(average_position) filter (where average_position is not null), 2) as average_position
  from clean_answer_rows
  group by question_id, option_key
),
option_json as (
  select
    option.question_id,
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'key', option.option_key,
          'count', option.answer_count,
          'averagePosition', option.average_position
        )
      )
      order by option.answer_count desc, option.option_key asc
    ) as options
  from option_counts as option
  group by option.question_id
),
card_rows as (
  select
    question.league_id,
    question.sort_order,
    jsonb_build_object(
      'questionSlug', question.slug,
      'title', question.title,
      'entityType', question.entity_type,
      'metric', question.metric,
      'section', question.section,
      'respondentCount', coalesce(total.respondent_count, 0),
      'options', coalesce(options.options, '[]'::jsonb)
    ) as card
  from eligible_questions as question
  left join question_totals as total
    on total.question_id = question.id
  left join option_json as options
    on options.question_id = question.id
),
league_cards as (
  select
    card.league_id,
    jsonb_agg(card.card order by card.sort_order) as cards
  from card_rows as card
  group by card.league_id
),
member_counts as (
  select
    league.id as league_id,
    count(member.user_id)::integer as member_count
  from public.leagues as league
  left join active_members as member
    on member.league_id = league.id
  group by league.id
)
insert into public.league_bonus_statistics (
  league_id,
  generated_at,
  member_count,
  statistics_json
)
select
  league.id,
  statement_timestamp(),
  member_count.member_count,
  jsonb_build_object(
    'version', 2,
    'cards', coalesce(cards.cards, '[]'::jsonb)
  )
from public.leagues as league
join member_counts as member_count
  on member_count.league_id = league.id
left join league_cards as cards
  on cards.league_id = league.id
on conflict (league_id) do nothing;
