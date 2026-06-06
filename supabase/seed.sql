insert into public.tournaments (slug, name, season_year, starts_at, ends_at)
values ('world-cup-2026', 'Mistrzostwa Świata 2026', 2026, '2026-06-11', '2026-07-19')
on conflict (slug) do nothing;

with tournament as (
  select id from public.tournaments where slug = 'world-cup-2026'
)
insert into public.tournament_stages (tournament_id, code, name, short_name, sort_order)
select id, code, name, short_name, sort_order
from tournament
cross join (
  values
    ('group_round_1', 'Faza grupowa — kolejka 1', 'Kolejka 1', 10),
    ('group_round_2', 'Faza grupowa — kolejka 2', 'Kolejka 2', 20),
    ('group_round_3', 'Faza grupowa — kolejka 3', 'Kolejka 3', 30),
    ('round_of_32', '1/16 finału', 'R32', 40),
    ('round_of_16', '1/8 finału', 'R16', 50),
    ('quarter_finals', 'Ćwierćfinały', 'ĆF', 60),
    ('semi_finals', 'Półfinały', 'PF', 70),
    ('third_place', 'Mecz o 3. miejsce', '3. miejsce', 80),
    ('final', 'Finał', 'Finał', 90)
) as stages(code, name, short_name, sort_order)
on conflict (tournament_id, code) do nothing;
