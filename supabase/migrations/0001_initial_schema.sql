create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  timezone text not null default 'Europe/Warsaw',
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Gracz')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  season_year integer not null,
  starts_at date not null,
  ends_at date not null,
  created_at timestamptz not null default now()
);

create table public.tournament_stages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  code text not null,
  name text not null,
  short_name text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (tournament_id, code),
  unique (id, tournament_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  provider text,
  external_id text,
  name text not null,
  country_code text,
  flag_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tournament_id)
);

create unique index teams_provider_external_id_unique
  on public.teams (tournament_id, provider, external_id)
  where provider is not null and external_id is not null;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  provider text,
  external_id text,
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index players_provider_external_id_unique
  on public.players (provider, external_id)
  where provider is not null and external_id is not null;

create unique index players_team_normalized_name_unique
  on public.players (team_id, normalized_name);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage_id uuid not null,
  provider text,
  external_id text,
  home_team_id uuid not null,
  away_team_id uuid not null,
  starts_at_utc timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished', 'confirmed', 'postponed')),
  home_score_90 integer check (home_score_90 is null or home_score_90 >= 0),
  away_score_90 integer check (away_score_90 is null or away_score_90 >= 0),
  first_scorer_player_id uuid references public.players(id) on delete set null,
  no_scorer_confirmed boolean not null default false,
  result_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_stage_fk foreign key (stage_id, tournament_id)
    references public.tournament_stages(id, tournament_id),
  constraint matches_home_team_fk foreign key (home_team_id, tournament_id)
    references public.teams(id, tournament_id),
  constraint matches_away_team_fk foreign key (away_team_id, tournament_id)
    references public.teams(id, tournament_id),
  constraint matches_distinct_teams check (home_team_id <> away_team_id),
  unique (id, tournament_id)
);

create unique index matches_provider_external_id_unique
  on public.matches (tournament_id, provider, external_id)
  where provider is not null and external_id is not null;

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  provider text,
  provider_event_id text,
  event_type text not null,
  minute integer not null check (minute >= 0),
  extra_minute integer check (extra_minute is null or extra_minute >= 0),
  team_id uuid references public.teams(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  player_name text,
  detail text,
  created_at timestamptz not null default now()
);

create unique index match_events_provider_event_unique
  on public.match_events (match_id, provider, provider_event_id)
  where provider is not null and provider_event_id is not null;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  owner_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tournament_id)
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  tournament_id uuid not null,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint league_members_league_fk foreign key (league_id, tournament_id)
    references public.leagues(id, tournament_id) on delete cascade,
  unique (league_id, user_id)
);

create unique index league_members_one_active_league_per_tournament
  on public.league_members (tournament_id, user_id)
  where status = 'active';

create table public.league_invite_codes (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  code_hash text not null unique,
  active boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.match_predictions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  predicted_home_score integer not null check (predicted_home_score >= 0),
  predicted_away_score integer not null check (predicted_away_score >= 0),
  first_scorer_player_id uuid references public.players(id) on delete set null,
  no_scorer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id, match_id),
  constraint match_predictions_scorer_check check (
    (no_scorer = true and first_scorer_player_id is null and predicted_home_score = 0 and predicted_away_score = 0)
    or (no_scorer = false and first_scorer_player_id is not null)
  )
);

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  result_points integer not null default 2 check (result_points >= 0),
  exact_score_bonus integer not null default 3 check (exact_score_bonus >= 0),
  first_scorer_points integer not null default 3 check (first_scorer_points >= 0),
  active boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index scoring_rules_one_active_per_league
  on public.scoring_rules (league_id)
  where active;

create table public.bonus_questions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  title text not null,
  points integer not null check (points >= 0),
  deadline_at timestamptz not null,
  correct_option_id uuid,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bonus_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.bonus_questions(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (question_id, sort_order)
);

alter table public.bonus_questions
  add constraint bonus_questions_correct_option_fk
  foreign key (correct_option_id) references public.bonus_question_options(id) on delete set null;

create table public.bonus_predictions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.bonus_questions(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  option_id uuid not null references public.bonus_question_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create table public.score_breakdowns (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  source_type text not null check (source_type in ('match', 'bonus')),
  source_id uuid not null,
  stage_id uuid references public.tournament_stages(id) on delete set null,
  outcome_points integer not null default 0,
  exact_score_points integer not null default 0,
  first_scorer_points integer not null default 0,
  bonus_points integer not null default 0,
  total_points integer not null default 0,
  calculated_at timestamptz not null default now(),
  unique (league_id, user_id, source_type, source_id)
);

create table public.synchronization_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('api-football', 'football-data', 'manual')),
  status text not null check (status in ('success', 'warning', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  request_count integer not null default 0 check (request_count >= 0),
  message text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  league_id uuid references public.leagues(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index tournament_stages_tournament_sort_idx on public.tournament_stages (tournament_id, sort_order);
create index teams_tournament_idx on public.teams (tournament_id);
create index players_team_idx on public.players (team_id);
create index matches_tournament_starts_idx on public.matches (tournament_id, starts_at_utc);
create index matches_stage_idx on public.matches (stage_id);
create index match_events_match_idx on public.match_events (match_id);
create index leagues_tournament_idx on public.leagues (tournament_id);
create index league_members_league_idx on public.league_members (league_id);
create index league_members_user_idx on public.league_members (user_id);
create index league_invite_codes_league_idx on public.league_invite_codes (league_id);
create index match_predictions_match_idx on public.match_predictions (match_id);
create index match_predictions_user_idx on public.match_predictions (user_id);
create index bonus_questions_league_deadline_idx on public.bonus_questions (league_id, deadline_at);
create index bonus_question_options_question_idx on public.bonus_question_options (question_id);
create index bonus_predictions_user_idx on public.bonus_predictions (user_id);
create index score_breakdowns_league_user_idx on public.score_breakdowns (league_id, user_id);
create index score_breakdowns_stage_idx on public.score_breakdowns (stage_id);
create index synchronization_logs_started_idx on public.synchronization_logs (started_at desc);
create index admin_audit_logs_league_created_idx on public.admin_audit_logs (league_id, created_at desc);

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and is_admin = true
  );
$$;

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members
    where league_id = p_league_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function public.is_league_admin(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin()
    or exists (
      select 1
      from public.leagues
      where id = p_league_id
        and owner_user_id = (select auth.uid())
    );
$$;

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_stages enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_invite_codes enable row level security;
alter table public.match_predictions enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.bonus_questions enable row level security;
alter table public.bonus_question_options enable row level security;
alter table public.bonus_predictions enable row level security;
alter table public.score_breakdowns enable row level security;
alter table public.synchronization_logs enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy profiles_read_authenticated on public.profiles
  for select to authenticated
  using (true);

create policy tournaments_read_authenticated on public.tournaments
  for select to authenticated
  using (true);

create policy tournament_stages_read_authenticated on public.tournament_stages
  for select to authenticated
  using (true);

create policy teams_read_authenticated on public.teams
  for select to authenticated
  using (true);

create policy players_read_authenticated on public.players
  for select to authenticated
  using (true);

create policy matches_read_authenticated on public.matches
  for select to authenticated
  using (true);

create policy match_events_read_after_start_or_admin on public.match_events
  for select to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1
      from public.matches m
      where m.id = match_events.match_id
        and clock_timestamp() >= m.starts_at_utc
    )
  );

create policy leagues_read_members on public.leagues
  for select to authenticated
  using (public.is_league_member(id) or public.is_app_admin());

create policy league_members_read_members on public.league_members
  for select to authenticated
  using (public.is_league_member(league_id) or public.is_app_admin());

create policy league_invite_codes_read_admin on public.league_invite_codes
  for select to authenticated
  using (public.is_league_admin(league_id));

create policy match_predictions_read_own_or_after_start on public.match_predictions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_app_admin()
    or (
      public.is_league_member(league_id)
      and exists (
        select 1
        from public.matches m
        where m.id = match_predictions.match_id
          and clock_timestamp() >= m.starts_at_utc
      )
    )
  );

create policy scoring_rules_read_members on public.scoring_rules
  for select to authenticated
  using (public.is_league_member(league_id) or public.is_league_admin(league_id));

create policy bonus_questions_read_members on public.bonus_questions
  for select to authenticated
  using (public.is_league_member(league_id) or public.is_league_admin(league_id));

create policy bonus_question_options_read_members on public.bonus_question_options
  for select to authenticated
  using (
    exists (
      select 1
      from public.bonus_questions q
      where q.id = bonus_question_options.question_id
        and (public.is_league_member(q.league_id) or public.is_league_admin(q.league_id))
    )
  );

create policy bonus_predictions_read_own_or_after_deadline on public.bonus_predictions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_app_admin()
    or exists (
      select 1
      from public.bonus_questions q
      where q.id = bonus_predictions.question_id
        and public.is_league_member(q.league_id)
        and clock_timestamp() >= q.deadline_at
    )
  );

create policy score_breakdowns_read_members on public.score_breakdowns
  for select to authenticated
  using (public.is_league_member(league_id) or public.is_league_admin(league_id));

create policy synchronization_logs_read_admin on public.synchronization_logs
  for select to authenticated
  using (public.is_app_admin());

create policy admin_audit_logs_read_admin on public.admin_audit_logs
  for select to authenticated
  using (public.is_app_admin() or public.is_league_admin(league_id));

create or replace function public.join_league_by_code(p_code text)
returns public.league_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_hash text;
  v_invite public.league_invite_codes;
  v_league public.leagues;
  v_member public.league_members;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  v_hash := encode(digest(lower(trim(p_code)), 'sha256'), 'hex');

  select *
  into v_invite
  from public.league_invite_codes
  where code_hash = v_hash
    and active = true
    and (expires_at is null or expires_at > clock_timestamp())
    and (max_uses is null or used_count < max_uses)
  for update;

  if not found then
    raise exception 'invalid_invite_code';
  end if;

  select * into v_league from public.leagues where id = v_invite.league_id;

  if exists (
    select 1
    from public.league_members
    where tournament_id = v_league.tournament_id
      and user_id = v_user_id
      and status = 'active'
      and league_id <> v_league.id
  ) then
    raise exception 'already_joined_tournament_league';
  end if;

  insert into public.league_members (league_id, tournament_id, user_id, status, joined_at, removed_at)
  values (v_league.id, v_league.tournament_id, v_user_id, 'active', now(), null)
  on conflict (league_id, user_id)
  do update set status = 'active', joined_at = now(), removed_at = null
  returning * into v_member;

  update public.league_invite_codes
  set used_count = used_count + 1
  where id = v_invite.id;

  return v_member;
end;
$$;

create or replace function public.update_profile(p_display_name text, p_timezone text default null, p_avatar_url text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
  set
    display_name = nullif(trim(p_display_name), ''),
    timezone = coalesce(nullif(trim(p_timezone), ''), timezone),
    avatar_url = p_avatar_url,
    updated_at = now()
  where user_id = v_user_id
  returning * into v_profile;

  if v_profile.user_id is null then
    raise exception 'profile_not_found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.create_league_invite_code(
  p_league_id uuid,
  p_plain_code text,
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns public.league_invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.league_invite_codes;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_league_admin(p_league_id) then
    raise exception 'admin_required';
  end if;

  if length(trim(p_plain_code)) < 6 then
    raise exception 'invite_code_too_short';
  end if;

  insert into public.league_invite_codes (league_id, code_hash, max_uses, expires_at, created_by)
  values (
    p_league_id,
    encode(digest(lower(trim(p_plain_code)), 'sha256'), 'hex'),
    p_max_uses,
    p_expires_at,
    v_user_id
  )
  returning * into v_invite;

  insert into public.admin_audit_logs (actor_user_id, league_id, action, entity_table, entity_id, after_data, reason)
  values (v_user_id, p_league_id, 'create_invite_code', 'league_invite_codes', v_invite.id, to_jsonb(v_invite), 'Admin generated join code');

  return v_invite;
end;
$$;

create or replace function public.upsert_match_prediction(
  p_match_id uuid,
  p_predicted_home_score integer,
  p_predicted_away_score integer,
  p_first_scorer_player_id uuid default null,
  p_no_scorer boolean default false
)
returns public.match_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.matches;
  v_league_id uuid;
  v_prediction public.match_predictions;
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

  select lm.league_id
  into v_league_id
  from public.league_members lm
  join public.leagues l on l.id = lm.league_id
  where lm.user_id = v_user_id
    and lm.status = 'active'
    and l.tournament_id = v_match.tournament_id
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
    now()
  )
  on conflict (league_id, user_id, match_id)
  do update set
    predicted_home_score = excluded.predicted_home_score,
    predicted_away_score = excluded.predicted_away_score,
    first_scorer_player_id = excluded.first_scorer_player_id,
    no_scorer = excluded.no_scorer,
    updated_at = now()
  returning * into v_prediction;

  return v_prediction;
end;
$$;

create or replace function public.delete_match_prediction(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.matches;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches where id = p_match_id for share;

  if not found then
    raise exception 'match_not_found';
  end if;

  if clock_timestamp() >= v_match.starts_at_utc then
    raise exception 'prediction_locked';
  end if;

  delete from public.match_predictions
  where match_id = p_match_id
    and user_id = v_user_id;
end;
$$;

create or replace function public.upsert_bonus_prediction(p_question_id uuid, p_option_id uuid)
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

  select * into v_question
  from public.bonus_questions
  where id = p_question_id
  for share;

  if not found then
    raise exception 'bonus_question_not_found';
  end if;

  if clock_timestamp() >= v_question.deadline_at then
    raise exception 'bonus_prediction_locked';
  end if;

  if not public.is_league_member(v_question.league_id) then
    raise exception 'league_membership_required';
  end if;

  if not exists (
    select 1
    from public.bonus_question_options
    where id = p_option_id
      and question_id = p_question_id
  ) then
    raise exception 'invalid_bonus_option';
  end if;

  insert into public.bonus_predictions (question_id, user_id, option_id, updated_at)
  values (p_question_id, v_user_id, p_option_id, now())
  on conflict (question_id, user_id)
  do update set option_id = excluded.option_id, updated_at = now()
  returning * into v_prediction;

  return v_prediction;
end;
$$;

create or replace function public.set_match_result(
  p_match_id uuid,
  p_home_score_90 integer,
  p_away_score_90 integer,
  p_first_scorer_player_id uuid default null,
  p_no_scorer_confirmed boolean default false,
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

  if p_home_score_90 < 0 or p_away_score_90 < 0 then
    raise exception 'invalid_score';
  end if;

  select * into v_before from public.matches where id = p_match_id for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if p_no_scorer_confirmed and (p_home_score_90 <> 0 or p_away_score_90 <> 0) then
    raise exception 'no_scorer_requires_zero_zero';
  end if;

  if p_first_scorer_player_id is not null and not exists (
    select 1
    from public.players
    where id = p_first_scorer_player_id
      and team_id in (v_before.home_team_id, v_before.away_team_id)
  ) then
    raise exception 'first_scorer_not_in_match';
  end if;

  update public.matches
  set
    home_score_90 = p_home_score_90,
    away_score_90 = p_away_score_90,
    first_scorer_player_id = case when p_no_scorer_confirmed then null else p_first_scorer_player_id end,
    no_scorer_confirmed = p_no_scorer_confirmed,
    status = 'confirmed',
    result_confirmed_at = now(),
    updated_at = now()
  where id = p_match_id
  returning * into v_after;

  insert into public.admin_audit_logs (actor_user_id, action, entity_table, entity_id, before_data, after_data, reason)
  values (v_user_id, 'set_match_result', 'matches', p_match_id, to_jsonb(v_before), to_jsonb(v_after), p_reason);

  perform public.recalculate_match_scores(p_match_id);

  return v_after;
end;
$$;

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
        when p.no_scorer = false and p.first_scorer_player_id is not null and p.first_scorer_player_id = m.first_scorer_player_id
          then sr.first_scorer_points
        else 0
      end as first_scorer_points
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
    0,
    outcome_points + exact_score_points + first_scorer_points,
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
    case when bp.option_id = q.correct_option_id then q.points else 0 end,
    case when bp.option_id = q.correct_option_id then q.points else 0 end,
    now()
  from public.bonus_predictions bp
  join public.bonus_questions q on q.id = bp.question_id
  where q.id = p_question_id
    and q.correct_option_id is not null
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
    select id
    from public.bonus_questions
    where league_id = p_league_id
      and correct_option_id is not null
  loop
    v_total := v_total + public.recalculate_bonus_scores(v_question_id);
  end loop;

  return v_total;
end;
$$;

create or replace view public.league_rankings
with (security_invoker = true)
as
select
  sb.league_id,
  sb.user_id,
  p.display_name,
  coalesce(sum(sb.total_points), 0)::integer as total_points,
  coalesce(sum(sb.outcome_points), 0)::integer as outcome_points,
  coalesce(sum(sb.exact_score_points), 0)::integer as exact_score_points,
  coalesce(sum(sb.first_scorer_points), 0)::integer as first_scorer_points,
  coalesce(sum(sb.bonus_points), 0)::integer as bonus_points
from public.score_breakdowns sb
join public.profiles p on p.user_id = sb.user_id
group by sb.league_id, sb.user_id, p.display_name;

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
revoke execute on all functions in schema public from public;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_admin(uuid) to authenticated;
grant execute on function public.join_league_by_code(text) to authenticated;
grant execute on function public.update_profile(text, text, text) to authenticated;
grant execute on function public.create_league_invite_code(uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.upsert_match_prediction(uuid, integer, integer, uuid, boolean) to authenticated;
grant execute on function public.delete_match_prediction(uuid) to authenticated;
grant execute on function public.upsert_bonus_prediction(uuid, uuid) to authenticated;
grant execute on function public.set_match_result(uuid, integer, integer, uuid, boolean, text) to authenticated;
grant execute on function public.recalculate_match_scores(uuid) to authenticated;
grant execute on function public.recalculate_bonus_scores(uuid) to authenticated;
grant execute on function public.recalculate_league_scores(uuid) to authenticated;
