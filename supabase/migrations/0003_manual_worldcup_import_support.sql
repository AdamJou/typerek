alter table public.teams
  add column if not exists group_code text,
  add column if not exists confederation text;

alter table public.players
  add column if not exists shirt_number integer
    check (shirt_number is null or (shirt_number >= 1 and shirt_number <= 99));

alter table public.matches
  alter column home_team_id drop not null,
  alter column away_team_id drop not null;

alter table public.matches
  add column if not exists match_number integer,
  add column if not exists round_name text,
  add column if not exists group_code text,
  add column if not exists venue text,
  add column if not exists home_placeholder text,
  add column if not exists away_placeholder text;

alter table public.matches
  drop constraint if exists matches_distinct_teams;

alter table public.matches
  add constraint matches_distinct_teams
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id);

alter table public.matches
  drop constraint if exists matches_home_team_or_placeholder;

alter table public.matches
  add constraint matches_home_team_or_placeholder
  check (home_team_id is not null or nullif(trim(home_placeholder), '') is not null);

alter table public.matches
  drop constraint if exists matches_away_team_or_placeholder;

alter table public.matches
  add constraint matches_away_team_or_placeholder
  check (away_team_id is not null or nullif(trim(away_placeholder), '') is not null);

create unique index if not exists players_team_shirt_number_unique
  on public.players (team_id, shirt_number)
  where shirt_number is not null;

create index if not exists matches_match_number_idx
  on public.matches (match_number);

create index if not exists matches_group_code_idx
  on public.matches (group_code);

create or replace function app_private.import_manual_teams(p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_count integer := 0;
begin
  select id into v_tournament_id
  from public.tournaments
  where slug = 'world-cup-2026';

  if v_tournament_id is null then
    raise exception 'world_cup_2026_tournament_not_found';
  end if;

  with input as (
    select *
    from jsonb_to_recordset(p_payload) as x(
      fifa_code text,
      name text,
      flag_code text,
      group_code text,
      confederation text
    )
  )
  insert into public.teams (
    tournament_id,
    provider,
    external_id,
    name,
    country_code,
    flag_code,
    group_code,
    confederation,
    updated_at
  )
  select
    v_tournament_id,
    'openfootball',
    fifa_code,
    name,
    fifa_code,
    flag_code,
    group_code,
    confederation,
    now()
  from input
  where fifa_code is not null
    and name is not null
  on conflict (tournament_id, provider, external_id)
  where provider is not null and external_id is not null
  do update set
    name = excluded.name,
    country_code = excluded.country_code,
    flag_code = excluded.flag_code,
    group_code = excluded.group_code,
    confederation = excluded.confederation,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function app_private.import_manual_matches(p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_count integer := 0;
begin
  select id into v_tournament_id
  from public.tournaments
  where slug = 'world-cup-2026';

  if v_tournament_id is null then
    raise exception 'world_cup_2026_tournament_not_found';
  end if;

  with input as (
    select *
    from jsonb_to_recordset(p_payload) as x(
      external_id text,
      match_number integer,
      stage_code text,
      round_name text,
      group_code text,
      starts_at_utc timestamptz,
      home_team_code text,
      away_team_code text,
      home_placeholder text,
      away_placeholder text,
      venue text
    )
  ),
  resolved as (
    select
      input.*,
      stage.id as stage_id,
      home_team.id as home_team_id,
      away_team.id as away_team_id
    from input
    join public.tournament_stages stage
      on stage.tournament_id = v_tournament_id
     and stage.code = input.stage_code
    left join public.teams home_team
      on home_team.tournament_id = v_tournament_id
     and home_team.provider = 'openfootball'
     and home_team.external_id = input.home_team_code
    left join public.teams away_team
      on away_team.tournament_id = v_tournament_id
     and away_team.provider = 'openfootball'
     and away_team.external_id = input.away_team_code
  )
  insert into public.matches (
    tournament_id,
    stage_id,
    provider,
    external_id,
    match_number,
    round_name,
    group_code,
    home_team_id,
    away_team_id,
    home_placeholder,
    away_placeholder,
    starts_at_utc,
    status,
    venue,
    updated_at
  )
  select
    v_tournament_id,
    stage_id,
    'openfootball',
    external_id,
    match_number,
    round_name,
    group_code,
    home_team_id,
    away_team_id,
    home_placeholder,
    away_placeholder,
    starts_at_utc,
    'scheduled',
    venue,
    now()
  from resolved
  where external_id is not null
    and starts_at_utc is not null
    and (home_team_id is not null or nullif(trim(home_placeholder), '') is not null)
    and (away_team_id is not null or nullif(trim(away_placeholder), '') is not null)
  on conflict (tournament_id, provider, external_id)
  where provider is not null and external_id is not null
  do update set
    stage_id = excluded.stage_id,
    match_number = excluded.match_number,
    round_name = excluded.round_name,
    group_code = excluded.group_code,
    home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id,
    home_placeholder = excluded.home_placeholder,
    away_placeholder = excluded.away_placeholder,
    starts_at_utc = excluded.starts_at_utc,
    venue = excluded.venue,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function app_private.import_manual_players(p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_count integer := 0;
begin
  select id into v_tournament_id
  from public.tournaments
  where slug = 'world-cup-2026';

  if v_tournament_id is null then
    raise exception 'world_cup_2026_tournament_not_found';
  end if;

  with input as (
    select *
    from jsonb_to_recordset(p_payload) as x(
      team_code text,
      shirt_number integer,
      position text,
      name text
    )
  ),
  resolved as (
    select
      input.*,
      team.id as team_id
    from input
    join public.teams team
      on team.tournament_id = v_tournament_id
     and team.provider = 'openfootball'
     and team.external_id = input.team_code
  )
  insert into public.players (
    team_id,
    provider,
    external_id,
    name,
    position,
    shirt_number,
    active,
    updated_at
  )
  select
    team_id,
    'fifa-squad-list-2026',
    team_code || ':' || shirt_number::text,
    name,
    position,
    shirt_number,
    true,
    now()
  from resolved
  where team_code is not null
    and shirt_number is not null
    and position in ('GK', 'DF', 'MF', 'FW')
    and nullif(trim(name), '') is not null
  on conflict (provider, external_id)
  where provider is not null and external_id is not null
  do update set
    team_id = excluded.team_id,
    name = excluded.name,
    position = excluded.position,
    shirt_number = excluded.shirt_number,
    active = true,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function app_private.import_manual_teams(jsonb) from public, anon, authenticated;
revoke execute on function app_private.import_manual_matches(jsonb) from public, anon, authenticated;
revoke execute on function app_private.import_manual_players(jsonb) from public, anon, authenticated;
grant execute on function app_private.import_manual_teams(jsonb) to service_role;
grant execute on function app_private.import_manual_matches(jsonb) to service_role;
grant execute on function app_private.import_manual_players(jsonb) to service_role;

revoke execute on function app_private.is_app_admin() from public, anon;
revoke execute on function app_private.is_league_member(uuid) from public, anon;
revoke execute on function app_private.is_league_admin(uuid) from public, anon;
