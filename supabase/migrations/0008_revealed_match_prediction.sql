create or replace function public.get_revealed_match_prediction(
  p_match_id uuid,
  p_user_id uuid
)
returns public.match_predictions
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prediction public.match_predictions;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  select prediction.*
  into v_prediction
  from public.match_predictions as prediction
  join public.matches as match
    on match.id = prediction.match_id
  where prediction.match_id = p_match_id
    and prediction.user_id = p_user_id
    and (
      clock_timestamp() >= match.starts_at_utc
      or match.result_confirmed_at is not null
    )
    and (
      app_private.is_league_member(prediction.league_id)
      or app_private.is_app_admin()
    );

  return v_prediction;
end;
$$;

revoke all on function public.get_revealed_match_prediction(uuid, uuid) from public, anon;
grant execute on function public.get_revealed_match_prediction(uuid, uuid) to authenticated, service_role;
