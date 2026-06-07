<script setup lang="ts">
import { Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { BONUS_QUESTION_CATALOG } from '~/data/bonusQuestionCatalog'
import type {
  BonusQuestionConfig,
  BonusQuestionKind,
  BonusQuestionResolution,
  BonusQuestionSourceKind,
  Player,
  Team,
  TournamentStage,
} from '~/types/domain'
import { formatShortDate } from '~/utils/date'
import { normalizeBonusText, questionKindLabel, type ResolvedBonusQuestion } from '~/utils/bonus'

interface BonusQuestionFormState {
  title: string
  slug: string
  points: number
  deadlineAt: string
  lockAt: string
  displayOrder: number
  kind: BonusQuestionKind
  sourceKind: BonusQuestionSourceKind
  subjectLabel: string
  subjectPlayerName: string
  subjectTeamName: string
  threshold: string
  maxValue: string
  maxSelections: string
  groupSize: string
  helperText: string
  note: string
  playerNamesText: string
  teamNamesText: string
  hostTeamNamesText: string
  stageCodesText: string
  comparisonOptionsText: string
}

const props = defineProps<{
  questions: readonly ResolvedBonusQuestion[]
  resolutionsByQuestionId: ReadonlyMap<string, BonusQuestionResolution>
  defaultDeadlineAt: string | null
  teams: readonly Team[]
  players: readonly Player[]
  stages: readonly TournamentStage[]
}>()

const { createBonusQuestion, deleteBonusQuestion, league } = useTyperekData()

const selectedTemplateSlug = shallowRef('')
const isSaving = shallowRef(false)
const deletingQuestionId = shallowRef('')
const errorMessage = shallowRef('')
const successMessage = shallowRef('')
const slugTouched = shallowRef(false)

const form = reactive<BonusQuestionFormState>(createInitialFormState())

const playerNameSuggestions = computed(() => [...props.players].map((player) => player.name).sort((left, right) => left.localeCompare(right, 'pl')))
const teamNameSuggestions = computed(() => [...props.teams].map((team) => team.name).sort((left, right) => left.localeCompare(right, 'pl')))
const kindOptions = computed(() => {
  const values = new Set<string>()

  for (const question of props.questions) {
    if (question.kind) {
      values.add(question.kind)
    }
  }

  for (const entry of BONUS_QUESTION_CATALOG) {
    values.add(entry.kind)
  }

  return [...values]
    .sort((left, right) => questionKindLabel(left as BonusQuestionKind).localeCompare(questionKindLabel(right as BonusQuestionKind), 'pl'))
    .map((value) => ({ value: value as BonusQuestionKind, label: questionKindLabel(value as BonusQuestionKind) }))
})
const sourceKindOptions = computed(() => {
  const values = new Set<string>()

  for (const question of props.questions) {
    if (question.sourceKind) {
      values.add(question.sourceKind)
    }
  }

  for (const entry of BONUS_QUESTION_CATALOG) {
    values.add(entry.sourceKind)
  }

  return [...values]
    .sort((left, right) => sourceKindLabel(left as BonusQuestionSourceKind).localeCompare(sourceKindLabel(right as BonusQuestionSourceKind), 'pl'))
    .map((value) => ({ value: value as BonusQuestionSourceKind, label: sourceKindLabel(value as BonusQuestionSourceKind) }))
})
const selectedTemplate = computed(() => BONUS_QUESTION_CATALOG.find((entry) => entry.slug === selectedTemplateSlug.value) ?? null)
const pointsLabel = computed(() => `${Math.max(0, form.points || 0)} pkt`)
const previewTitle = computed(() => safeTrim(form.title) || 'Nowe pytanie bonusowe')
const previewSlug = computed(() => safeTrim(form.slug) || autoSlug(previewTitle.value))
const previewOrder = computed(() => Math.max(1, Number.isInteger(form.displayOrder) ? form.displayOrder : props.questions.length + 1))
const validationMessage = computed(() => {
  if (!league.id) {
    return 'Brak aktywnej ligi do zapisania pytania.'
  }

  if (!safeTrim(form.title)) {
    return 'Podaj tytuł pytania.'
  }

  if (!form.deadlineAt) {
    return 'Podaj deadline pytania.'
  }

  if (form.points < 0) {
    return 'Liczba punktów nie może być ujemna.'
  }

  if (form.displayOrder < 1) {
    return 'Kolejność musi zaczynać się od 1.'
  }

  if (form.sourceKind === 'fixed_player' && !safeTrim(form.subjectPlayerName)) {
    return 'Dla źródła fixed_player podaj nazwę zawodnika.'
  }

  if (form.sourceKind === 'fixed_team' && !safeTrim(form.subjectTeamName)) {
    return 'Dla źródła fixed_team podaj nazwę drużyny.'
  }

  if (form.sourceKind === 'duel_players' && splitLines(form.playerNamesText).length < 2) {
    return 'Pojedynek zawodników wymaga co najmniej 2 nazw.'
  }

  if (form.sourceKind === 'duel_teams' && splitLines(form.teamNamesText).length < 2) {
    return 'Pojedynek drużyn wymaga co najmniej 2 nazw.'
  }

  if (form.sourceKind === 'host_teams' && splitLines(form.hostTeamNamesText).length === 0) {
    return 'Podaj przynajmniej jedną drużynę gospodarza.'
  }

  if (form.sourceKind === 'comparison_options' && parseComparisonOptions(form.comparisonOptionsText).length < 2) {
    return 'Porównanie wymaga co najmniej 2 opcji.'
  }

  return ''
})

watch(selectedTemplateSlug, (slug) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!slug) {
    resetForm()
    return
  }

  const template = BONUS_QUESTION_CATALOG.find((entry) => entry.slug === slug)

  if (!template) {
    return
  }

  slugTouched.value = false
  Object.assign(form, createInitialFormState({
    title: template.title,
    slug: template.slug,
    points: template.points,
    kind: template.kind,
    sourceKind: template.sourceKind,
    configJson: template.config,
  }))
})

watch(
  () => form.title,
  (title) => {
    if (!slugTouched.value) {
      form.slug = autoSlug(title)
    }
  },
)

watch(
  () => props.questions.length,
  () => {
    if (!isSaving.value) {
      form.displayOrder = props.questions.length + 1
    }
  },
)

async function submitQuestion() {
  errorMessage.value = ''
  successMessage.value = ''

  if (validationMessage.value) {
    errorMessage.value = validationMessage.value
    return
  }

  isSaving.value = true

  try {
    await createBonusQuestion({
      leagueId: league.id,
      title: safeTrim(form.title),
      slug: previewSlug.value,
      points: Math.max(0, form.points),
      deadlineAt: new Date(form.deadlineAt).toISOString(),
      lockAt: form.lockAt ? new Date(form.lockAt).toISOString() : new Date(form.deadlineAt).toISOString(),
      displayOrder: previewOrder.value,
      kind: form.kind,
      sourceKind: form.sourceKind,
      configJson: buildConfigJson(),
    })

    successMessage.value = 'Pytanie bonusowe zostało dodane.'
    selectedTemplateSlug.value = ''
    resetForm({ deadlineAt: form.deadlineAt, lockAt: form.lockAt })
  } catch (error) {
    errorMessage.value = bonusQuestionErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

async function removeQuestion(question: ResolvedBonusQuestion) {
  errorMessage.value = ''
  successMessage.value = ''

  if (import.meta.client && !window.confirm(`Usunąć pytanie "${question.title}"?`)) {
    return
  }

  deletingQuestionId.value = question.id

  try {
    await deleteBonusQuestion(question.id)
    successMessage.value = 'Pytanie bonusowe zostało usunięte.'
  } catch (error) {
    errorMessage.value = bonusQuestionErrorMessage(error)
  } finally {
    deletingQuestionId.value = ''
  }
}

function onSlugInput(value: string) {
  const normalized = safeString(value)
  slugTouched.value = normalized.trim().length > 0
  form.slug = normalized
}

function resetForm(overrides: Partial<Pick<BonusQuestionFormState, 'deadlineAt' | 'lockAt'>> = {}) {
  slugTouched.value = false
  Object.assign(form, createInitialFormState(overrides))
}

function createInitialFormState(
  overrides: Partial<{
    title: string
    slug: string
    points: number
    kind: BonusQuestionKind
    sourceKind: BonusQuestionSourceKind
    configJson: BonusQuestionConfig
    deadlineAt: string
    lockAt: string
  }> = {},
): BonusQuestionFormState {
  const configJson = overrides.configJson ?? {}
  const deadlineAt = overrides.deadlineAt ?? toDateTimeLocal(props.defaultDeadlineAt)
  const lockAt = overrides.lockAt ?? deadlineAt

  return {
    title: overrides.title ?? '',
    slug: overrides.slug ?? '',
    points: overrides.points ?? 10,
    deadlineAt,
    lockAt,
    displayOrder: props.questions.length + 1,
    kind: overrides.kind ?? 'numeric',
    sourceKind: overrides.sourceKind ?? 'manual_fact',
    subjectLabel: stringValue(configJson.subjectLabel),
    subjectPlayerName: stringValue(configJson.subjectPlayerName),
    subjectTeamName: stringValue(configJson.subjectTeamName),
    threshold: numberString(configJson.threshold),
    maxValue: numberString(configJson.maxValue),
    maxSelections: numberString(configJson.maxSelections),
    groupSize: numberString(configJson.groupSize),
    helperText: stringValue(configJson.helperText),
    note: stringValue(configJson.note),
    playerNamesText: arrayValue(configJson.playerNames).join('\n'),
    teamNamesText: arrayValue(configJson.teamNames).join('\n'),
    hostTeamNamesText: arrayValue(configJson.hostTeamNames).join('\n'),
    stageCodesText: arrayValue(configJson.stageCodes).join('\n'),
    comparisonOptionsText: arrayValue(configJson.comparisonOptions).map(formatComparisonOption).join('\n'),
  }
}

function buildConfigJson(): BonusQuestionConfig {
  const config: BonusQuestionConfig = {}
  const threshold = parseInteger(form.threshold)
  const maxValue = parseInteger(form.maxValue)
  const maxSelections = parseInteger(form.maxSelections)
  const groupSize = parseInteger(form.groupSize)

  if (safeTrim(form.subjectLabel)) {
    config.subjectLabel = safeTrim(form.subjectLabel)
  }

  if (safeTrim(form.subjectPlayerName)) {
    config.subjectPlayerName = safeTrim(form.subjectPlayerName)
  }

  if (safeTrim(form.subjectTeamName)) {
    config.subjectTeamName = safeTrim(form.subjectTeamName)
  }

  if (threshold !== null) {
    config.threshold = threshold
  }

  if (maxValue !== null) {
    config.maxValue = maxValue
  }

  if (maxSelections !== null) {
    config.maxSelections = maxSelections
  }

  if (groupSize !== null) {
    config.groupSize = groupSize
  }

  if (safeTrim(form.helperText)) {
    config.helperText = safeTrim(form.helperText)
  }

  if (safeTrim(form.note)) {
    config.note = safeTrim(form.note)
  }

  const playerNames = splitLines(form.playerNamesText)
  if (playerNames.length) {
    config.playerNames = playerNames
  }

  const teamNames = splitLines(form.teamNamesText)
  if (teamNames.length) {
    config.teamNames = teamNames
  }

  const hostTeamNames = splitLines(form.hostTeamNamesText)
  if (hostTeamNames.length) {
    config.hostTeamNames = hostTeamNames
  }

  const stageCodes = splitLines(form.stageCodesText)
  if (stageCodes.length) {
    config.stageCodes = stageCodes
  }

  const comparisonOptions = parseComparisonOptions(form.comparisonOptionsText)
  if (comparisonOptions.length) {
    config.comparisonOptions = comparisonOptions
  }

  return config
}

function parseComparisonOptions(value: string) {
  return splitLines(value)
    .map((line, index) => {
      const [rawKey = '', rawLabel = ''] = line.includes('|') ? line.split('|', 2) : ['', line]
      const label = rawLabel.trim() || rawKey.trim()
      const key = (rawKey.trim() || normalizeBonusText(label).replace(/\s+/g, '_') || `option_${index + 1}`).slice(0, 64)

      if (!label) {
        return null
      }

      return {
        key,
        label,
      }
    })
    .filter((option): option is { key: string; label: string } => Boolean(option))
}

function splitLines(value: string) {
  return safeString(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function autoSlug(value: string) {
  const normalized = normalizeBonusText(value).replace(/\s+/g, '-')
  return normalized.slice(0, 80)
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function parseInteger(value: string) {
  const normalized = safeTrim(value)

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isInteger(parsed) ? parsed : null
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

function safeTrim(value: unknown) {
  return safeString(value).trim()
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function numberString(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : []
}

function formatComparisonOption(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return ''
  }

  const key = 'key' in value ? String(value.key ?? '') : ''
  const label = 'label' in value ? String(value.label ?? '') : ''
  return [key, label].filter(Boolean).join('|')
}

function sourceKindLabel(kind: BonusQuestionSourceKind) {
  const labels: Record<BonusQuestionSourceKind, string> = {
    fixed_player: 'Stały zawodnik',
    fixed_team: 'Stała drużyna',
    players: 'Lista zawodników',
    goalkeepers: 'Lista bramkarzy',
    teams: 'Lista drużyn',
    host_teams: 'Gospodarze',
    team_stages: 'Etapy turnieju',
    duel_players: 'Pojedynek zawodników',
    duel_teams: 'Pojedynek drużyn',
    comparison_options: 'Opcje porównania',
    group_teams: 'Drużyny grupowe',
    manual_fact: 'Manualny fakt',
    tournament_fact: 'Fakt turniejowy',
  }

  return labels[kind]
}

function resolutionLabel(questionId: string) {
  const resolution = props.resolutionsByQuestionId.get(questionId)

  if (!resolution) {
    return 'Brak resolution snapshotu'
  }

  return `${resolution.status} · ${resolution.sourceStatus}`
}

function bonusQuestionErrorMessage(error: unknown) {
  const message = extractErrorMessage(error)

  if (message.includes('admin_required')) {
    return 'Tylko admin może zarządzać pytaniami bonusowymi.'
  }

  if (message.includes('not_authenticated')) {
    return 'Zaloguj się ponownie, aby zarządzać pytaniami bonusowymi.'
  }

  if (message.includes('bonus_question_title_required')) {
    return 'Tytuł pytania jest wymagany.'
  }

  if (message.includes('bonus_question_points_invalid')) {
    return 'Liczba punktów musi być poprawną liczbą całkowitą większą lub równą 0.'
  }

  if (message.includes('bonus_question_deadline_required')) {
    return 'Deadline pytania jest wymagany.'
  }

  if (message.includes('bonus_question_kind_invalid')) {
    return 'Wybrany typ pytania jest niepoprawny.'
  }

  if (message.includes('bonus_question_source_kind_invalid')) {
    return 'Wybrany typ źródła danych jest niepoprawny.'
  }

  if (message.includes('bonus_question_not_found')) {
    return 'Nie znaleziono pytania bonusowego do usunięcia.'
  }

  if (message.includes('bonus_questions_slug_idx')) {
    return 'Pytanie z takim slugiem już istnieje w tej lidze.'
  }

  return message
}

function extractErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return 'Nie udało się zapisać pytania bonusowego.'
  }

  if ('data' in error && typeof error.data === 'object' && error.data !== null && 'statusMessage' in error.data) {
    return String(error.data.statusMessage)
  }

  if ('statusMessage' in error) {
    return String(error.statusMessage)
  }

  if ('message' in error) {
    return String(error.message)
  }

  return 'Nie udało się zapisać pytania bonusowego.'
}
</script>

<template>
  <section class="section-block">
    <div class="section-heading">
      <div>
        <span class="eyebrow">Aktualna liga</span>
        <h2>Zarządzanie pytaniami</h2>
      </div>
    </div>

    <form class="manager-grid" @submit.prevent="submitQuestion">
      <section class="builder-card panel">
        <div class="builder-heading">
          <div>
            <span class="eyebrow">Kreator</span>
            <h3>{{ previewTitle }}</h3>
          </div>
          <span class="points-pill">{{ pointsLabel }}</span>
        </div>

        <div class="builder-meta">
          <span class="meta-chip">{{ questionKindLabel(form.kind) }}</span>
          <span class="meta-chip">{{ sourceKindLabel(form.sourceKind) }}</span>
          <span class="meta-chip">Kolejność: {{ previewOrder }}</span>
        </div>

        <div class="form-grid">
          <label class="field-span-2">
            <span class="eyeless-label">Szablon z katalogu</span>
            <select v-model="selectedTemplateSlug" class="input">
              <option value="">Puste pytanie</option>
              <option v-for="template in BONUS_QUESTION_CATALOG" :key="template.slug" :value="template.slug">
                {{ template.title }} · {{ template.points }} pkt
              </option>
            </select>
          </label>

          <label class="field-span-2">
            <span class="eyeless-label">Tytuł pytania</span>
            <input v-model="form.title" class="input" type="text" placeholder="Np. Kto wygra mundial?" />
          </label>

          <label>
            <span class="eyeless-label">Slug</span>
            <input :model-value="form.slug" class="input" type="text" placeholder="np-kto-wygra-mundial" @input="onSlugInput(($event.target as HTMLInputElement).value)" />
          </label>

          <label>
            <span class="eyeless-label">Punkty</span>
            <input v-model.number="form.points" class="input" type="number" min="0" step="1" />
          </label>

          <label>
            <span class="eyeless-label">Deadline</span>
            <input v-model="form.deadlineAt" class="input" type="datetime-local" />
          </label>

          <label>
            <span class="eyeless-label">Lock</span>
            <input v-model="form.lockAt" class="input" type="datetime-local" />
          </label>

          <label>
            <span class="eyeless-label">Kolejność</span>
            <input v-model.number="form.displayOrder" class="input" type="number" min="1" step="1" />
          </label>

          <label>
            <span class="eyeless-label">Typ pytania</span>
            <select v-model="form.kind" class="input">
              <option v-for="option in kindOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>

          <label>
            <span class="eyeless-label">Typ źródła</span>
            <select v-model="form.sourceKind" class="input">
              <option v-for="option in sourceKindOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>

          <label>
            <span class="eyeless-label">Label tematu</span>
            <input v-model="form.subjectLabel" class="input" type="text" placeholder="Opcjonalny podpis" />
          </label>

          <label>
            <span class="eyeless-label">Limit / max</span>
            <input v-model="form.maxValue" class="input" type="number" min="0" step="1" placeholder="Np. 20" />
          </label>

          <label>
            <span class="eyeless-label">Threshold</span>
            <input v-model="form.threshold" class="input" type="number" min="0" step="1" placeholder="Np. 6" />
          </label>

          <label>
            <span class="eyeless-label">Max selections</span>
            <input v-model="form.maxSelections" class="input" type="number" min="0" step="1" placeholder="Np. 4" />
          </label>

          <label>
            <span class="eyeless-label">Group size</span>
            <input v-model="form.groupSize" class="input" type="number" min="0" step="1" placeholder="Np. 4" />
          </label>

          <label class="field-span-2">
            <span class="eyeless-label">Helper text</span>
            <input v-model="form.helperText" class="input" type="text" placeholder="Krótka podpowiedź dla gracza" />
          </label>

          <label class="field-span-2">
            <span class="eyeless-label">Notatka techniczna</span>
            <textarea v-model="form.note" class="input textarea-input" placeholder="Opis źródła lub uwagi admina"></textarea>
          </label>

          <label v-if="form.sourceKind === 'fixed_player'" class="field-span-2">
            <span class="eyeless-label">Zawodnik</span>
            <input v-model="form.subjectPlayerName" class="input" type="text" list="bonus-player-suggestions" placeholder="Jedna pełna nazwa zawodnika" />
          </label>

          <label v-if="form.sourceKind === 'fixed_team'" class="field-span-2">
            <span class="eyeless-label">Drużyna</span>
            <input v-model="form.subjectTeamName" class="input" type="text" list="bonus-team-suggestions" placeholder="Jedna pełna nazwa drużyny" />
          </label>

          <label v-if="form.sourceKind === 'duel_players'" class="field-span-2">
            <span class="eyeless-label">Nazwy zawodników, po jednej w linii</span>
            <textarea v-model="form.playerNamesText" class="input textarea-input" placeholder="Lionel Messi&#10;Cristiano Ronaldo"></textarea>
          </label>

          <label v-if="form.sourceKind === 'duel_teams'" class="field-span-2">
            <span class="eyeless-label">Nazwy drużyn, po jednej w linii</span>
            <textarea v-model="form.teamNamesText" class="input textarea-input" placeholder="Brazil&#10;Argentina"></textarea>
          </label>

          <label v-if="form.sourceKind === 'host_teams'" class="field-span-2">
            <span class="eyeless-label">Gospodarze, po jednej drużynie w linii</span>
            <textarea v-model="form.hostTeamNamesText" class="input textarea-input" placeholder="United States&#10;Canada&#10;Mexico"></textarea>
          </label>

          <label v-if="form.kind === 'team_stage_exit'" class="field-span-2">
            <span class="eyeless-label">Dozwolone kody etapów, po jednym w linii</span>
            <textarea v-model="form.stageCodesText" class="input textarea-input" :placeholder="props.stages.map((stage) => stage.code).join('\n')"></textarea>
          </label>

          <label v-if="form.sourceKind === 'comparison_options'" class="field-span-2">
            <span class="eyeless-label">Opcje porównania, format key|label</span>
            <textarea v-model="form.comparisonOptionsText" class="input textarea-input" placeholder="own_goals|Więcej swojaków&#10;red_cards|Więcej czerwonych kartek"></textarea>
          </label>
        </div>

        <p class="preview-copy">
          Slug: <strong>{{ previewSlug || 'brak' }}</strong> · Deadline:
          <strong>{{ form.deadlineAt ? formatShortDate(new Date(form.deadlineAt).toISOString()) : 'brak daty' }}</strong>
        </p>

        <p v-if="validationMessage" class="feedback feedback-error" role="alert">{{ validationMessage }}</p>
        <p v-else-if="errorMessage" class="feedback feedback-error" role="alert">{{ errorMessage }}</p>
        <p v-else-if="successMessage" class="feedback feedback-success" role="status">{{ successMessage }}</p>

        <div class="builder-actions">
          <button class="button-ghost" type="button" @click="resetForm()">Wyczyść</button>
          <button class="button-primary" type="submit" :disabled="isSaving || Boolean(validationMessage)">
            <Loader2 v-if="isSaving" :size="18" class="spinner" aria-hidden="true" />
            <Plus v-else :size="18" aria-hidden="true" />
            {{ isSaving ? 'Dodaję pytanie' : 'Dodaj pytanie' }}
          </button>
        </div>
      </section>

      <section class="question-list-shell">
        <div v-if="props.questions.length" class="db-question-list">
          <article v-for="question in props.questions" :key="question.id" class="db-question-card panel">
            <div class="card-topline">
              <strong>{{ question.title }}</strong>
              <div class="card-actions">
                <span class="points-pill">{{ question.points }} pkt</span>
                <button class="button-danger icon-button" type="button" :disabled="deletingQuestionId === question.id" @click="removeQuestion(question)">
                  <Loader2 v-if="deletingQuestionId === question.id" :size="16" class="spinner" aria-hidden="true" />
                  <Trash2 v-else :size="16" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div class="meta-grid">
              <span class="meta-chip">{{ questionKindLabel(question.kind) }}</span>
              <span class="meta-chip">{{ question.sourceStatus === 'auto' ? 'Auto' : question.sourceStatus === 'partial' ? 'Częściowo auto' : 'Manual' }}</span>
              <span class="meta-chip">Slug: {{ question.slug }}</span>
              <span class="meta-chip">Kolejność: {{ question.displayOrder ?? 'brak' }}</span>
              <span class="meta-chip">Lock: {{ formatShortDate(question.lockAt ?? question.deadlineAt) }}</span>
            </div>

            <p class="source-note">{{ question.sourceNote }}</p>

            <div class="resolution-box">
              <strong>Rozliczenie</strong>
              <span>{{ resolutionLabel(question.id) }}</span>
            </div>
          </article>
        </div>

        <p v-else class="empty-panel panel">Brak pytań bonusowych w bazie dla aktualnej ligi.</p>
      </section>
    </form>

    <datalist id="bonus-player-suggestions">
      <option v-for="name in playerNameSuggestions" :key="name" :value="name" />
    </datalist>

    <datalist id="bonus-team-suggestions">
      <option v-for="name in teamNameSuggestions" :key="name" :value="name" />
    </datalist>
  </section>
</template>

<style scoped>
.section-block,
.db-question-list,
.form-grid,
.builder-card,
.question-list-shell {
  display: grid;
  gap: 16px;
}

.manager-grid {
  display: grid;
  gap: 16px;
  align-items: start;
}

.builder-card,
.db-question-card,
.empty-panel {
  padding: 16px;
}

.section-heading h2,
.builder-heading h3,
.card-topline strong,
.resolution-box strong,
.preview-copy,
.source-note,
.empty-panel,
.feedback {
  margin: 0;
}

.eyebrow,
.preview-copy,
.source-note,
.resolution-box span,
.empty-panel {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 800;
}

.eyebrow {
  text-transform: uppercase;
}

.section-heading h2 {
  font-size: 24px;
}

.builder-heading,
.card-topline,
.builder-actions,
.card-actions,
.meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.builder-heading,
.card-topline,
.builder-actions {
  align-items: center;
  justify-content: space-between;
}

.builder-heading > div {
  display: grid;
  gap: 4px;
}

.builder-heading h3 {
  font-size: 20px;
  line-height: 1.15;
}

.form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-span-2 {
  grid-column: 1 / -1;
}

.textarea-input {
  min-height: 108px;
  resize: vertical;
}

.meta-grid {
  gap: 8px;
}

.points-pill,
.meta-chip {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 999px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 900;
}

.points-pill {
  background: #fff3d7;
  color: #856111;
}

.meta-chip {
  border: 1px solid var(--app-line);
  background: #f7faf7;
  color: var(--app-muted);
}

.resolution-box {
  display: grid;
  gap: 4px;
  border-top: 1px solid var(--app-line);
  padding-top: 12px;
}

.icon-button {
  min-width: 42px;
  padding: 0;
}

.feedback {
  border-radius: 7px;
  padding: 12px;
}

.feedback-error {
  border: 1px solid #f0d58e;
  background: #fff7df;
  color: #735712;
}

.feedback-success {
  border: 1px solid rgba(12, 107, 70, 0.2);
  background: rgba(12, 107, 70, 0.08);
  color: var(--app-primary-dark);
}

.spinner {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 1180px) {
  .manager-grid {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  }
}

@media (max-width: 780px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: auto;
  }
}
</style>