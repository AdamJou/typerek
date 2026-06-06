with league_context as (
  select
    l.id as league_id,
    ((t.starts_at::date)::timestamp at time zone 'Europe/Warsaw') as lock_at
  from public.leagues l
  join public.tournaments t on t.id = l.tournament_id
  where t.slug = 'world-cup-2026'
  order by l.id
  limit 1
),
question_seed as (
  select *
  from (
    values
      (1, 'q01-gyokeres-goals', 'Ile goli strzeli Gyokeres?', 15, 'player_numeric', 'fixed_player', '{"subjectPlayerName":"Viktor Einar GYÖKERES","maxValue":20}'::jsonb),
      (2, 'q02-world-cup-winner', 'Kto wygra mundial?', 30, 'team_single', 'teams', '{}'::jsonb),
      (3, 'q03-spain-exit-stage', 'Na jakim etapie odpadnie Hiszpania?', 15, 'team_stage_exit', 'team_stages', '{"subjectTeamName":"Spain"}'::jsonb),
      (4, 'q04-curacao-group-points', 'Ile punktów zdobędzie Curacao?', 10, 'team_numeric', 'fixed_team', '{"subjectTeamName":"Curaçao","maxValue":9}'::jsonb),
      (5, 'q05-top-scorer', 'Kto zostanie królem strzelców?', 20, 'player_single', 'players', '{}'::jsonb),
      (6, 'q06-top-assists', 'Kto zostanie królem asyst?', 20, 'player_single', 'players', '{}'::jsonb),
      (7, 'q07-golden-glove', 'Kto otrzyma złotą rękawicę?', 20, 'player_single', 'goalkeepers', '{}'::jsonb),
      (8, 'q08-own-goals-vs-red-cards', 'Czego będzie więcej: swojaków czy czerwonych kartek?', 10, 'comparison_numeric', 'comparison_options', '{"comparisonOptions":[{"key":"own_goals","label":"Więcej swojaków"},{"key":"red_cards","label":"Więcej czerwonych kartek"}]}'::jsonb),
      (9, 'q09-direct-free-kick-goals', 'Ilość goli bezpośrednio z rzutów wolnych', 15, 'numeric', 'manual_fact', '{"maxValue":20}'::jsonb),
      (10, 'q10-ronaldo-goals', 'Ile goli strzeli Cristiano Ronaldo?', 15, 'player_numeric', 'fixed_player', '{"subjectPlayerName":"Cristiano RonaldoDOS SANTOS AVEIRO RONALDO","maxValue":20}'::jsonb),
      (11, 'q11-messi-goals-plus-assists', 'Ile goli plus asyst zdobędzie Lionel Messi?', 15, 'player_numeric', 'fixed_player', '{"subjectPlayerName":"Lionel Andrés MESSI","maxValue":30}'::jsonb),
      (12, 'q12-neymar-over-240-minutes', 'Czy Neymar rozegra więcej niż 240 minut na tym turnieju?', 5, 'boolean', 'fixed_player', '{"subjectPlayerName":"Neymar DA SILVA SANTOS JÚNIOR","threshold":240}'::jsonb),
      (13, 'q13-vinicius-yellow-card', 'Czy Vinicius otrzyma żółtą kartkę podczas turnieju?', 5, 'boolean', 'fixed_player', '{"subjectPlayerName":"Vinicius José PAIXÃO DE OLIVEIRA JÚNIOR"}'::jsonb),
      (14, 'q14-brazil-past-quarter-finals', 'Czy Brazylia przejdzie dalej niż ćwierćfinał?', 5, 'boolean', 'fixed_team', '{"subjectTeamName":"Brazil"}'::jsonb),
      (15, 'q15-uefa-teams-in-knockout', 'Ile europejskich drużyn przejdzie do fazy pucharowej?', 15, 'numeric', 'tournament_fact', '{"maxValue":16,"confederation":"UEFA"}'::jsonb),
      (16, 'q16-most-cards-team', 'Drużyna z największą ilością kartek?', 20, 'team_single', 'teams', '{}'::jsonb),
      (17, 'q17-bellingham-vs-wirtz', 'Kto będzie miał więcej punktów w klasyfikacji kanadyjskiej: Bellingham czy Wirtz?', 5, 'duel_player', 'duel_players', '{"playerNames":["Jude Victor William BELLINGHAM","Florian Richard WIRTZ"]}'::jsonb),
      (18, 'q18-england-over-6-group-goals', 'Czy Anglia zdobędzie więcej niż 6 bramek w fazie grupowej?', 5, 'boolean', 'fixed_team', '{"subjectTeamName":"England","threshold":6}'::jsonb),
      (19, 'q19-mbappe-vs-yamal', 'Kto zdobędzie więcej goli Mbappe czy Yamal?', 10, 'duel_player', 'duel_players', '{"playerNames":["Kylian MBAPPE LOTTIN","Lamine Yamal NASRAOUI EBANA"]}'::jsonb),
      (20, 'q20-modric-goal', 'Czy Luka Modric zdobędzie gola na turnieju?', 5, 'boolean', 'fixed_player', '{"subjectPlayerName":"Luka MODRIĆ"}'::jsonb),
      (21, 'q21-african-teams-from-groups', 'Ile drużyn afrykańskich wyjdzie z grupy?', 10, 'numeric', 'tournament_fact', '{"maxValue":9,"confederation":"CAF"}'::jsonb),
      (22, 'q22-son-over-1-goal', 'Czy Heung Min Son zdobędzie więcej niż 1 gola na turnieju?', 5, 'boolean', 'fixed_player', '{"subjectPlayerName":"Heung Min SON","threshold":1}'::jsonb),
      (23, 'q23-casemiro-over-1-yellow', 'Czy Casemiro zdobędzie więcej niż 1 żółtą kartkę?', 5, 'boolean', 'fixed_player', '{"subjectPlayerName":"Casemiro","threshold":1}'::jsonb),
      (24, 'q24-top-four', 'Wytypuj swoje top 4 turnieju', 30, 'ranked_top4', 'teams', '{"maxSelections":4}'::jsonb),
      (25, 'q25-ronaldo-vs-messi-stage', 'Kto zajdzie dalej Cr7 czy Messi', 5, 'duel_player', 'duel_players', '{"playerNames":["Cristiano RonaldoDOS SANTOS AVEIRO RONALDO","Lionel Andrés MESSI"]}'::jsonb),
      (26, 'q26-weather-postponements', 'Ile meczów zostanie przełożonych z powodów atmosferycznych?', 20, 'numeric', 'manual_fact', '{"maxValue":10}'::jsonb),
      (27, 'q27-penalty-goals-over-30', 'Czy padnie więcej niż 30 goli z rzutów karnych?', 10, 'boolean', 'manual_fact', '{"threshold":30}'::jsonb),
      (28, 'q28-bosnia-group-points', 'Ilość punktów Bośni i Hercegowiny w fazie grupowej?', 10, 'team_numeric', 'fixed_team', '{"subjectTeamName":"Bosnia & Herzegovina","maxValue":9}'::jsonb),
      (29, 'q29-hosts-out-of-groups', 'Ilu gospodarzy wyjdzie z grupy?', 10, 'numeric', 'host_teams', '{"hostTeamNames":["United States","Canada","Mexico"],"maxValue":3}'::jsonb),
      (30, 'q30-host-longest-run', 'Która drużyna z gospodarzy będzie grała na turnieju najdłużej?', 10, 'team_single', 'host_teams', '{"hostTeamNames":["United States","Canada","Mexico"]}'::jsonb),
      (31, 'q31-arsenal-goal-scorers-count', 'Ilu zawodników Arsenalu zdobędzie gola na turnieju?', 15, 'numeric', 'manual_fact', '{"maxValue":15}'::jsonb),
      (32, 'q32-most-corners-team', 'Drużyna z największą ilością rzutów różnych?', 20, 'team_single', 'teams', '{}'::jsonb),
      (33, 'q33-chris-wood-goal', 'Czy Chris Wood strzeli bramkę?', 5, 'boolean', 'fixed_player', '{"subjectPlayerName":"Christopher Grant WOOD"}'::jsonb),
      (34, 'q34-kdb-vs-bfik-assists', 'Kto zdobędzie więcej asyst Kdb czy Bruno Fernandes?', 10, 'duel_player', 'duel_players', '{"playerNames":["Kevin DE BRUYNE","Bruno Miguel BORGES FERNANDES"]}'::jsonb),
      (35, 'q35-most-goals-in-single-match', 'Największa ilość goli w meczu przez cały turniej', 15, 'numeric', 'tournament_fact', '{"maxValue":20}'::jsonb),
      (36, 'q36-australia-win-any-match', 'Czy Australia wygra jakieś spotkanie na turnieju?', 5, 'boolean', 'fixed_team', '{"subjectTeamName":"Australia"}'::jsonb),
      (37, 'q37-japan-vs-korea', 'Kto zajdzie dalej Japonia czy Korea Południowa?', 5, 'duel_team', 'duel_teams', '{"teamNames":["Japan","Korea Republic"]}'::jsonb),
      (38, 'q38-semenyo-vs-saka', 'Antoine Semenyo czy Bukayo Saka kto zdobędzie więcej punktów w klasyfikacji kanadyjskiej?', 5, 'duel_player', 'duel_players', '{"playerNames":["Antoine Serlom SEMENYO","Bukayo Ayoyinka SAKA"]}'::jsonb),
      (39, 'q39-ekstraklasa-goal-or-assist', 'Czy piłkarz z Ekstraklasy zdobędzie gola lub asystę?', 10, 'boolean', 'manual_fact', '{}'::jsonb),
      (40, 'q40-lukaku-goals', 'Ilość goli Romelu Lukaku na turnieju?', 15, 'player_numeric', 'fixed_player', '{"subjectPlayerName":"Romelu LUKAKU BOLINGOLI","maxValue":20}'::jsonb),
      (41, 'groups-stage-order', 'Typowanie grup', 120, 'ranked_group_table', 'group_teams', '{"groupSize":4}'::jsonb)
  ) as seed(display_order, slug, title, points, kind, source_kind, config_json)
)
insert into public.bonus_questions (
  league_id,
  slug,
  title,
  points,
  deadline_at,
  lock_at,
  display_order,
  kind,
  source_kind,
  config_json,
  correct_option_id
)
select
  lc.league_id,
  qs.slug,
  qs.title,
  qs.points,
  lc.lock_at,
  lc.lock_at,
  qs.display_order,
  qs.kind,
  qs.source_kind,
  qs.config_json,
  null
from league_context lc
cross join question_seed qs
on conflict (league_id, slug) where slug is not null
do update set
  title = excluded.title,
  points = excluded.points,
  deadline_at = excluded.deadline_at,
  lock_at = excluded.lock_at,
  display_order = excluded.display_order,
  kind = excluded.kind,
  source_kind = excluded.source_kind,
  config_json = excluded.config_json;
