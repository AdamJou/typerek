begin;

with eligible_questions as (
  select
    question.id,
    question.league_id,
    coalesce(question.slug, 'bonus-' || question.id::text) as question_slug,
    case
      when question.slug = 'q02-world-cup-winner' then 'Faworyt ligi do mistrzostwa'
      when question.slug = 'q24-top-four' then 'Najczęściej wybierane drużyny w Top 4'
      else question.title
    end as title,
    coalesce(question.kind, 'numeric') as kind,
    case
      when coalesce(question.kind, 'numeric') in ('team_single', 'duel_team', 'ranked_top4') then 'team'
      when coalesce(question.kind, 'numeric') in ('player_single', 'duel_player') then 'player'
      else 'choice'
    end as entity_type,
    case
      when coalesce(question.kind, 'numeric') = 'ranked_top4' then 'top4_presence'
      when coalesce(question.kind, 'numeric') = 'ranked_group_table' then 'group_consensus'
      when coalesce(question.kind, 'numeric') in ('numeric', 'player_numeric', 'team_numeric')
        then 'numeric_distribution'
      else 'answer'
    end as metric,
    case
      when question.slug in ('q02-world-cup-winner', 'q24-top-four') then 'featured'
      when question.slug in ('q05-top-scorer', 'q06-top-assists', 'q07-golden-glove')
        or lower(question.title) like '%mvp%'
        then 'awards'
      when coalesce(question.kind, 'numeric') = 'ranked_group_table' then 'groups'
      when coalesce(question.kind, 'numeric') = 'boolean'
        or question.slug in (
          'q04-curacao-group-points',
          'q12-neymar-over-240-minutes',
          'q20-modric-goal',
          'q22-son-over-1-goal',
          'q33-chris-wood-goal',
          'q36-australia-win-any-match',
          'q39-ekstraklasa-goal-or-assist'
        )
        or (
          lower(question.title) like '%haaland%'
          and lower(question.title) like '%uzbek%'
        )
        then 'sentiments'
      when coalesce(question.kind, 'numeric') in ('duel_player', 'duel_team', 'comparison_numeric')
        then 'duels'
      when coalesce(question.kind, 'numeric') in ('team_single', 'player_single', 'team_stage_exit')
        then 'picks'
      else 'forecasts'
    end as section,
    coalesce(question.display_order, 2147483647) as sort_order
  from public.bonus_questions as question
  where clock_timestamp() >= coalesce(question.lock_at, question.deadline_at)
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
    question.question_slug,
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
    prediction.user_id,
    case
      when prediction.kind = 'team_single' then prediction.answer_json ->> 'teamId'
      when prediction.kind = 'player_single' then prediction.answer_json ->> 'playerId'
      when prediction.kind = 'team_stage_exit' then prediction.answer_json ->> 'stageCode'
      when prediction.kind = 'boolean'
        then prediction.answer_json ->> 'value'
      when prediction.kind in ('numeric', 'player_numeric', 'team_numeric')
        and (prediction.answer_json ->> 'value') ~ '^-?[0-9]+([.][0-9]+)?$'
        then prediction.answer_json ->> 'value'
      else prediction.answer_json ->> 'winnerKey'
    end as option_key,
    null::numeric as average_position,
    case
      when prediction.metric = 'numeric_distribution'
        and (prediction.answer_json ->> 'value') ~ '^-?[0-9]+([.][0-9]+)?$'
        then (prediction.answer_json ->> 'value')::numeric
      else null::numeric
    end as numeric_value
  from valid_predictions as prediction
  where prediction.metric in ('answer', 'numeric_distribution')
),
top_four_answer_rows as (
  select
    prediction.question_id,
    prediction.user_id,
    selected_team.option_key,
    min(selected_team.position)::numeric as average_position,
    null::numeric as numeric_value
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
answer_totals as (
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
      order by
        case
          when question.metric = 'numeric_distribution'
            and option.option_key ~ '^-?[0-9]+([.][0-9]+)?$'
            then option.option_key::numeric
          else null
        end asc nulls last,
        option.answer_count desc,
        option.option_key asc
    ) as options
  from option_counts as option
  join eligible_questions as question
    on question.id = option.question_id
  group by option.question_id
),
numeric_stats as (
  select
    question_id,
    round(avg(numeric_value), 2) as average_value,
    round(
      (percentile_cont(0.5) within group (order by numeric_value))::numeric,
      2
    ) as median_value
  from clean_answer_rows
  where numeric_value is not null
  group by question_id
),
group_answer_rows as (
  select
    prediction.question_id,
    prediction.user_id,
    group_answer.group_code,
    selected_team.team_key,
    min(selected_team.position)::integer as position
  from valid_predictions as prediction
  cross join lateral (
    select
      group_value ->> 'groupCode' as group_code,
      group_value -> 'orderedTeamIds' as ordered_team_ids
    from jsonb_array_elements(
      case
        when jsonb_typeof(prediction.answer_json -> 'groups') = 'array'
          then prediction.answer_json -> 'groups'
        else '[]'::jsonb
      end
    ) as group_values(group_value)
    where nullif(btrim(group_value ->> 'groupCode'), '') is not null
      and case
        when jsonb_typeof(group_value -> 'orderedTeamIds') = 'array'
          then jsonb_array_length(group_value -> 'orderedTeamIds') = 4
        else false
      end
      and (
        select count(distinct team_id)
        from jsonb_array_elements_text(group_value -> 'orderedTeamIds') as distinct_team(team_id)
      ) = 4
  ) as group_answer
  cross join lateral jsonb_array_elements_text(
    group_answer.ordered_team_ids
  ) with ordinality as selected_team(team_key, position)
  where prediction.metric = 'group_consensus'
  group by
    prediction.question_id,
    prediction.user_id,
    group_answer.group_code,
    selected_team.team_key
),
group_question_totals as (
  select
    question_id,
    count(distinct user_id)::integer as respondent_count
  from group_answer_rows
  group by question_id
),
group_totals as (
  select
    question_id,
    group_code,
    count(distinct user_id)::integer as respondent_count
  from group_answer_rows
  group by question_id, group_code
),
group_team_counts as (
  select
    question_id,
    group_code,
    team_key,
    round(avg(position), 2) as average_position,
    count(*) filter (where position = 1)::integer as position_1_votes,
    count(*) filter (where position = 2)::integer as position_2_votes,
    count(*) filter (where position = 3)::integer as position_3_votes,
    count(*) filter (where position = 4)::integer as position_4_votes
  from group_answer_rows
  group by question_id, group_code, team_key
),
group_team_json as (
  select
    team.question_id,
    team.group_code,
    jsonb_agg(
      jsonb_build_object(
        'key', team.team_key,
        'averagePosition', team.average_position,
        'positionVotes', jsonb_build_array(
          team.position_1_votes,
          team.position_2_votes,
          team.position_3_votes,
          team.position_4_votes
        )
      )
      order by
        team.average_position asc,
        team.position_1_votes desc,
        team.position_2_votes desc,
        team.position_3_votes desc,
        team.position_4_votes desc,
        team.team_key asc
    ) as teams
  from group_team_counts as team
  group by team.question_id, team.group_code
),
group_json as (
  select
    group_result.question_id,
    jsonb_agg(
      jsonb_build_object(
        'groupCode', group_result.group_code,
        'respondentCount', group_result.respondent_count,
        'teams', group_result.teams
      )
      order by group_result.group_code asc
    ) as groups
  from (
    select
      total.question_id,
      total.group_code,
      total.respondent_count,
      teams.teams
    from group_totals as total
    join group_team_json as teams
      on teams.question_id = total.question_id
      and teams.group_code = total.group_code
  ) as group_result
  group by group_result.question_id
),
card_rows as (
  select
    question.league_id,
    question.sort_order,
    question.id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'questionSlug', question.question_slug,
        'title', question.title,
        'entityType', question.entity_type,
        'metric', question.metric,
        'section', question.section,
        'respondentCount', coalesce(answer_total.respondent_count, group_total.respondent_count, 0),
        'averageValue', numeric.average_value,
        'medianValue', numeric.median_value,
        'options', coalesce(options.options, '[]'::jsonb),
        'groups', groups.groups
      )
    ) as card
  from eligible_questions as question
  left join answer_totals as answer_total
    on answer_total.question_id = question.id
  left join group_question_totals as group_total
    on group_total.question_id = question.id
  left join option_json as options
    on options.question_id = question.id
  left join numeric_stats as numeric
    on numeric.question_id = question.id
  left join group_json as groups
    on groups.question_id = question.id
),
league_cards as (
  select
    card.league_id,
    jsonb_agg(card.card order by card.sort_order, card.id) as cards
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
    'version', 3,
    'cards', coalesce(cards.cards, '[]'::jsonb)
  )
from public.leagues as league
join member_counts as member_count
  on member_count.league_id = league.id
left join league_cards as cards
  on cards.league_id = league.id
on conflict (league_id) do update
set
  generated_at = excluded.generated_at,
  member_count = excluded.member_count,
  statistics_json = excluded.statistics_json;

commit;
