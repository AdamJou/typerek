create schema if not exists app_private;

revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.is_app_admin()
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

create or replace function app_private.is_league_member(p_league_id uuid)
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

create or replace function app_private.is_league_admin(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.is_app_admin()
    or exists (
      select 1
      from public.leagues
      where id = p_league_id
        and owner_user_id = (select auth.uid())
    );
$$;

grant execute on function app_private.is_app_admin() to authenticated, service_role;
grant execute on function app_private.is_league_member(uuid) to authenticated, service_role;
grant execute on function app_private.is_league_admin(uuid) to authenticated, service_role;

alter policy match_events_read_after_start_or_admin on public.match_events
  using (
    app_private.is_app_admin()
    or exists (
      select 1
      from public.matches m
      where m.id = match_events.match_id
        and clock_timestamp() >= m.starts_at_utc
    )
  );

alter policy leagues_read_members on public.leagues
  using (app_private.is_league_member(id) or app_private.is_app_admin());

alter policy league_members_read_members on public.league_members
  using (app_private.is_league_member(league_id) or app_private.is_app_admin());

alter policy league_invite_codes_read_admin on public.league_invite_codes
  using (app_private.is_league_admin(league_id));

alter policy match_predictions_read_own_or_after_start on public.match_predictions
  using (
    user_id = (select auth.uid())
    or app_private.is_app_admin()
    or (
      app_private.is_league_member(league_id)
      and exists (
        select 1
        from public.matches m
        where m.id = match_predictions.match_id
          and clock_timestamp() >= m.starts_at_utc
      )
    )
  );

alter policy scoring_rules_read_members on public.scoring_rules
  using (app_private.is_league_member(league_id) or app_private.is_league_admin(league_id));

alter policy bonus_questions_read_members on public.bonus_questions
  using (app_private.is_league_member(league_id) or app_private.is_league_admin(league_id));

alter policy bonus_question_options_read_members on public.bonus_question_options
  using (
    exists (
      select 1
      from public.bonus_questions q
      where q.id = bonus_question_options.question_id
        and (app_private.is_league_member(q.league_id) or app_private.is_league_admin(q.league_id))
    )
  );

alter policy bonus_predictions_read_own_or_after_deadline on public.bonus_predictions
  using (
    user_id = (select auth.uid())
    or app_private.is_app_admin()
    or exists (
      select 1
      from public.bonus_questions q
      where q.id = bonus_predictions.question_id
        and app_private.is_league_member(q.league_id)
        and clock_timestamp() >= q.deadline_at
    )
  );

alter policy score_breakdowns_read_members on public.score_breakdowns
  using (app_private.is_league_member(league_id) or app_private.is_league_admin(league_id));

alter policy synchronization_logs_read_admin on public.synchronization_logs
  using (app_private.is_app_admin());

alter policy admin_audit_logs_read_admin on public.admin_audit_logs
  using (app_private.is_app_admin() or app_private.is_league_admin(league_id));

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

alter function public.join_league_by_code(text) set search_path = public, extensions;
alter function public.create_league_invite_code(uuid, text, integer, timestamptz) set search_path = public, extensions;

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

create index if not exists admin_audit_logs_actor_user_idx
  on public.admin_audit_logs (actor_user_id);

create index if not exists bonus_predictions_option_idx
  on public.bonus_predictions (option_id);

create index if not exists bonus_questions_correct_option_idx
  on public.bonus_questions (correct_option_id);

create index if not exists bonus_questions_created_by_idx
  on public.bonus_questions (created_by);

create index if not exists league_invite_codes_created_by_idx
  on public.league_invite_codes (created_by);

create index if not exists league_members_league_tournament_idx
  on public.league_members (league_id, tournament_id);

create index if not exists leagues_owner_user_idx
  on public.leagues (owner_user_id);

create index if not exists match_events_player_idx
  on public.match_events (player_id);

create index if not exists match_events_team_idx
  on public.match_events (team_id);

create index if not exists match_predictions_first_scorer_idx
  on public.match_predictions (first_scorer_player_id);

create index if not exists matches_away_team_tournament_idx
  on public.matches (away_team_id, tournament_id);

create index if not exists matches_first_scorer_idx
  on public.matches (first_scorer_player_id);

create index if not exists matches_home_team_tournament_idx
  on public.matches (home_team_id, tournament_id);

create index if not exists matches_stage_tournament_idx
  on public.matches (stage_id, tournament_id);

create index if not exists score_breakdowns_user_idx
  on public.score_breakdowns (user_id);

create index if not exists scoring_rules_created_by_idx
  on public.scoring_rules (created_by);
