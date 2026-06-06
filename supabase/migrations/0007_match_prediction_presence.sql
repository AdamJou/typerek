create or replace function public.list_match_prediction_presence(p_league_id uuid)
returns table (
  match_id uuid,
  user_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  if not (
    app_private.is_league_member(p_league_id)
    or app_private.is_app_admin()
  ) then
    raise exception 'League membership required.';
  end if;

  return query
  select prediction.match_id, prediction.user_id
  from public.match_predictions as prediction
  join public.league_members as member
    on member.league_id = prediction.league_id
   and member.user_id = prediction.user_id
   and member.status = 'active'
  where prediction.league_id = p_league_id
  order by prediction.updated_at asc;
end;
$$;

revoke all on function public.list_match_prediction_presence(uuid) from public, anon;
grant execute on function public.list_match_prediction_presence(uuid) to authenticated, service_role;
