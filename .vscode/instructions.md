Chcę zaprojektować i później zbudować aplikację webową będącą prywatnym typerkiem do Mistrzostw Świata w piłce nożnej 2026.

Na tym etapie NIE generuj jeszcze całej aplikacji, NIE wdrażaj produkcji, NIE twórz migracji ani zasobów w Supabase i NIE podejmuj nieodwracalnych decyzji. Najpierw przygotuj bardzo konkretny plan techniczny oraz zweryfikuj, czy założenia da się zrealizować całkowicie bezpłatnie.

## Najważniejsze wymaganie

Całe rozwiązanie musi być możliwe do utrzymania za 0 zł:

* bez płatnego hostingu,
* bez płatnej bazy,
* bez płatnego crona,
* bez płatnego API sportowego,
* bez rozwiązań działających wyłącznie w okresie próbnym,
* bez wymagania podpięcia płatnej karty lub przejścia na płatny plan po uruchomieniu turnieju.

Jeżeli jakiekolwiek wymaganie nie jest realne do wykonania całkowicie za darmo, wskaż to otwarcie i zaproponuj darmowy fallback, nawet jeżeli oznacza częściowo ręczną administrację.

## Produkt

Aplikacja będzie polskojęzycznym, mobile-first typerkiem do Mistrzostw Świata 2026 dla prywatnej grupy znajomych, początkowo około 15 użytkowników.

Nie budujemy teraz uniwersalnej platformy turniejowej. MVP dotyczy tylko MŚ 2026, ale struktura kodu i bazy nie powinna uniemożliwiać obsługi kolejnych turniejów w przyszłości.

Stylistyka:

* nowoczesna,
* mobilna,
* piłkarska / mundialowa,
* karty meczów, flagi reprezentacji, ranking i etapy turnieju,
* bez używania oficjalnych logotypów lub assetów FIFA, jeżeli mogłoby to generować problemy prawne.

## Preferowany stack do oceny

Przeanalizuj i oceń ten kierunek:

* Nuxt w aktualnej stabilnej wersji + Vue + TypeScript,
* lekki interfejs bez automatycznego wyboru PrimeVue; zaproponuj najlepszą darmową opcję UI lub zwykły Tailwind/CSS,
* Cloudflare Pages jako darmowy hosting aplikacji Nuxt,
* Supabase Free jako:

  * PostgreSQL,
  * Auth,
  * Row Level Security,
  * ewentualnie Edge Functions i harmonogram,
* automatyczna synchronizacja danych przez:

  * Supabase Cron + Edge Function albo
  * Cloudflare Worker Cron,
* API sportowe ukryte po stronie backendu/Edge Function/Workera, nigdy wywoływane bezpośrednio z przeglądarki z tajnym kluczem.

Możesz zaproponować lepszy stack, ale tylko jeśli nadal będzie faktycznie darmowy i prostszy w utrzymaniu.

Jeżeli masz dostęp do integracji lub MCP dla Supabase, na tym etapie używaj go wyłącznie do analizy możliwości i dokumentacji. Nie twórz tabel, projektu ani konfiguracji bez mojej akceptacji planu.

## Użytkownicy i logowanie

MVP:

* logowanie przez email i hasło,
* architektura powinna pozwalać później dodać Google login i magic link,
* użytkownik może należeć tylko do jednej ligi w ramach MŚ 2026,
* nie ma globalnego rankingu,
* ranking istnieje wyłącznie wewnątrz ligi.

Sprawdź, czy email + hasło w Supabase da się sensownie obsłużyć całkowicie za darmo dla około 15 osób, uwzględniając rejestrację, potwierdzenie emaila, reset hasła oraz ewentualne ograniczenia wysyłki emaili. Jeżeli produkcyjna wysyłka maili wymagałaby dodatkowej płatnej usługi, zaproponuj darmowy wariant MVP.

## Ligi

W MVP:

* ligę może utworzyć tylko administrator, czyli ja,
* zwykli użytkownicy nie mogą tworzyć własnych lig,
* administrator tworzy ligę i generuje kod dołączenia,
* zalogowany użytkownik dołącza do ligi po kodzie,
* użytkownik może należeć tylko do jednej ligi,
* administrator może:

  * zmienić nazwę ligi,
  * zobaczyć uczestników,
  * usunąć uczestnika,
  * poprawić dane meczu,
  * poprawić wynik lub pierwszego strzelca,
  * ręcznie uruchomić synchronizację danych,
  * ręcznie uruchomić ponowne przeliczenie punktów.

Zaprojektuj bezpieczny sposób oznaczenia administratora. W MVP nie potrzebuję rozbudowanego systemu ról, ale zwykły użytkownik nie może uzyskać uprawnień administratora przez frontend.

## Mecze i typy użytkowników

Dla każdego meczu użytkownik typuje:

* dokładny wynik po 90 minutach, np. 2:1,
* jednego zawodnika jako przewidywanego pierwszego strzelca meczu,
* opcję „brak strzelca”, jeżeli przewiduje 0:0.

Nie typujemy wyniku po dogrywce ani po rzutach karnych. W fazie pucharowej punktacja zawsze dotyczy wyniku po regulaminowych 90 minutach.

Typ na dany mecz można:

* dodać,
* zmienić,
* usunąć lub nadpisać

wyłącznie przed rozpoczęciem tego konkretnego meczu.

Przykład:

* mecz A zaczyna się o 21:00,
* mecz B zaczyna się o 22:00,
* po 21:00 użytkownik nie może już zmienić typu na mecz A,
* nadal może typować mecz B aż do jego rozpoczęcia.

To ograniczenie musi być zabezpieczone po stronie bazy lub bezpiecznej logiki serwerowej, a nie tylko przez zablokowanie przycisku w interfejsie.

Czas rozpoczęcia meczu przechowuj w UTC. Interfejs ma prezentować godziny poprawnie w lokalnej strefie użytkownika.

## Punktacja MVP

Przyjmij jako początkową, konfigurowalną punktację:

* poprawne wskazanie rezultatu W/D/L: 2 punkty,
* dokładny wynik: dodatkowe 3 punkty, czyli łącznie 5 punktów za idealny wynik,
* poprawne wskazanie pierwszego strzelca meczu: dodatkowe 3 punkty,
* wskazanie „brak strzelca” daje bonus za pierwszego strzelca tylko wtedy, gdy mecz kończy się 0:0,
* nietrafiony strzelec: 0 punktów za bonus strzelca.

Punktacja nie może być zaszyta na stałe w komponentach frontendu. Zaproponuj konfigurację przechowywaną w bazie albo w jednoznacznym module domenowym, tak aby przed rozpoczęciem turnieju można było ją zmienić bez przepisywania aplikacji.

Ranking powinien pokazywać:

* sumę punktów,
* punkty z aktualnego etapu,
* punkty za wyniki meczów,
* punkty za dokładne wyniki,
* punkty za pierwszych strzelców,
* punkty za pytania bonusowe.

## Etapy turnieju

W MVP przygotuj strukturę etapów:

* faza grupowa — kolejka 1,
* faza grupowa — kolejka 2,
* faza grupowa — kolejka 3,
* 1/16 finału / Round of 32,
* 1/8 finału,
* ćwierćfinały,
* półfinały,
* mecz o 3. miejsce,
* finał.

Etapy nie powinny być hardcodowane w widokach. Mają być danymi, do których przypisane są mecze i rankingi cząstkowe.

## Pytania bonusowe

Przed rozpoczęciem turnieju administrator ligi może dodać własne pytania bonusowe, przykładowo:

* kto wygra mistrzostwa,
* kto zostanie królem strzelców,
* która reprezentacja zajdzie najdalej,
* inne pytania tworzone ręcznie przez administratora.

Założenia:

* pytania bonusowe są przypisane do ligi,
* administrator określa treść pytania, możliwe odpowiedzi oraz liczbę punktów,
* użytkownik odpowiada przed określonym deadline'em,
* po deadline użytkownik nie może zmienić odpowiedzi,
* administrator po zakończeniu odpowiedniego etapu oznacza poprawną odpowiedź,
* punkty są wtedy doliczane do rankingu.

W planie zaproponuj prosty model danych dla takich pytań.

## Dane meczowe i zewnętrzne API

Potrzebuję:

* terminarza meczów MŚ 2026,
* drużyn i podstawowych danych meczu,
* wyniku po 90 minutach,
* zdarzeń bramkowych pozwalających rozpoznać pierwszego strzelca,
* najlepiej także składów lub list zawodników, aby użytkownik mógł wybrać strzelca z listy.

Nie potrzebuję aktualizacji live co minutę. Wystarczy automatyczna synchronizacja wyników po zakończonych meczach oraz możliwość ręcznej synchronizacji przez administratora.

### Kandydat nr 1: API-Football

Zweryfikuj oficjalną dokumentację i, jeżeli możliwe bez klucza, publicznie dostępne informacje dotyczące API-Football.

Darmowy plan deklaruje 100 zapytań dziennie i endpointy obejmujące fixtures, events, lineups oraz top scorers, ale darmowy plan może ograniczać dostępne sezony.

Musisz ustalić:

* czy darmowy plan faktycznie obejmuje FIFA World Cup 2026,
* czy da się pobrać wszystkie 104 mecze turnieju,
* czy da się pobrać wynik po 90 minutach,
* czy endpoint events pozwala ustalić pierwszego strzelca,
* czy dostępna jest lista zawodników lub składy przydatne do typowania,
* czy 100 requestów dziennie wystarczy przy rozsądnym cache i synchronizacji,
* czy regulamin API pozwala użyć tych danych w prywatnej aplikacji typerskiej.

Jeżeli do pełnej weryfikacji potrzebny jest mój darmowy API key, opisz dokładnie, jaki klucz mam utworzyć i jakie minimalne testowe requesty wykonać w kolejnym kroku. Nie zakładaj bez dowodu, że API będzie wystarczające.

### Fallback całkowicie darmowy

Jeżeli API-Football nie zapewnia danych MŚ 2026 na darmowym planie albo warunki użycia będą problematyczne:

* wykorzystaj football-data.org wyłącznie do terminarza i wyników, jeżeli jego darmowy zakres to umożliwia,
* zaprojektuj panel administratora do ręcznego uzupełniania:

  * listy zawodników,
  * pierwszego strzelca,
  * ewentualnych poprawek wyniku,
* aplikacja nadal musi poprawnie liczyć punkty i rankingi.

Zaprojektuj integrację z API przez warstwę adaptera/provider interface, aby można było wymienić źródło danych bez przepisywania logiki aplikacji.

## Synchronizacja danych

Przygotuj plan synchronizacji, który mieści się w darmowych limitach.

Oczekuję podejścia podobnego do:

* jednorazowy import drużyn, meczów i terminarza,
* odświeżanie najbliższych/niedawno zakończonych meczów przez harmonogram,
* po zakończeniu meczu pobranie wyniku i zdarzeń bramkowych,
* zapis wyniku oraz pierwszego strzelca w bazie,
* automatyczne przeliczenie punktów po potwierdzeniu danych,
* ręczny przycisk administratora „Synchronizuj” i „Przelicz punkty” jako awaryjny fallback,
* log synchronizacji i błędów.

W planie policz orientacyjny budżet requestów na dzień dla fazy grupowej i fazy pucharowej, tak aby nie przekroczyć darmowego limitu API.

Nie projektuj pollingu live, jeżeli nie jest potrzebny.

## Bezpieczeństwo i integralność danych

Zaplanuj:

* Supabase Row Level Security dla wszystkich tabel dostępnych z frontendu,
* brak możliwości odczytania typów innych graczy przed startem meczu, jeżeli uznasz to za uczciwsze dla gry; opisz tę decyzję,
* bezpieczne blokowanie edycji typów po rozpoczęciu meczu,
* bezpieczne uprawnienia administratora,
* ukrycie klucza zewnętrznego API i Supabase service-role key,
* ochronę przed ręcznym wysłaniem requestu zmieniającego typ po deadline,
* logowanie ręcznych korekt administratora,
* sposób ponownego przeliczenia punktów bez duplikowania wyniku.

## Model danych

W planie zaproponuj tabele lub encje dla minimum:

* profiles,
* tournaments,
* tournament_stages,
* teams,
* players,
* matches,
* match_events lub first_goal_data,
* leagues,
* league_members,
* league_invite_codes,
* match_predictions,
* scoring_rules,
* bonus_questions,
* bonus_question_options,
* bonus_predictions,
* match_score_breakdowns albo inny sposób transparentnego zapisu punktów,
* synchronization_logs,
* admin_audit_logs.

Dla każdej tabeli opisz:

* cel,
* najważniejsze pola,
* klucze i relacje,
* unikalności,
* istotne indeksy,
* kto może czytać i zapisywać dane.

## Widoki aplikacji

Zaproponuj podstawowe ekrany mobile-first:

* logowanie i rejestracja,
* dołączenie do ligi kodem,
* strona główna ligi,
* lista nadchodzących meczów,
* formularz typowania meczu,
* historia własnych typów,
* ranking ogólny,
* ranking aktualnego etapu,
* pytania bonusowe,
* profil użytkownika,
* panel administratora:

  * utworzenie ligi,
  * generowanie kodu zaproszenia,
  * zarządzanie graczami,
  * edycja punktacji,
  * dodawanie pytań bonusowych,
  * ręczna korekta meczów i pierwszego strzelca,
  * synchronizacja API,
  * ponowne liczenie punktów,
  * podgląd logów.

## Co masz przygotować teraz

W pierwszej odpowiedzi przygotuj wyłącznie szczegółowy plan, bez implementowania aplikacji.

Plan ma zawierać:

1. Krótkie podsumowanie rekomendowanej architektury.
2. Tabelę wszystkich użytych usług z informacją:

   * po co są potrzebne,
   * jaki mają darmowy limit,
   * czy istnieje ryzyko kosztu,
   * jaki jest darmowy fallback.
3. Analizę API sportowego:

   * API-Football jako kandydat,
   * football-data.org jako fallback,
   * lista rzeczy wymagających rzeczywistego testu z darmowym kluczem.
4. Rekomendację hostingu i crona z uzasadnieniem, dlaczego wybrana opcja spełnia wymóg 0 zł.
5. Proponowany model danych.
6. Plan RLS i bezpieczeństwa.
7. Dokładny algorytm blokowania typów po rozpoczęciu meczu.
8. Dokładny algorytm punktacji i ponownego przeliczania rankingu.
9. Plan synchronizacji API wraz z budżetem requestów.
10. Listę stron i komponentów UI.
11. Podział realizacji na małe fazy implementacyjne, np.:

    * setup,
    * auth,
    * liga i zaproszenia,
    * mecze i typowanie,
    * ranking,
    * pytania bonusowe,
    * import/synchronizacja API,
    * panel administratora,
    * deployment.
12. Ryzyka, ograniczenia darmowych usług oraz decyzje, które wymagają mojej akceptacji przed kodowaniem.
13. Propozycję pierwszego małego kroku implementacyjnego po zaakceptowaniu planu.

Nie pisz jeszcze kodu aplikacji. Nie twórz projektu Supabase. Nie wykonuj deploymentu. Najpierw chcę zaakceptować architekturę, źródło danych i koszt zerowy.
