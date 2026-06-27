<script setup lang="ts">
import { ArrowLeftRight, Loader2, Save } from 'lucide-vue-next'
import type { Match, Team } from '~/types/domain'
import { displayTeamName } from '~/utils/footballUi'

const props = defineProps<{
  match: Match
  teams: readonly Team[]
}>()

const { setMatchTeams } = useTyperekData()
const isSaving = shallowRef(false)
const homeTeamId = shallowRef('')
const awayTeamId = shallowRef('')
const errorMessage = shallowRef('')
const successMessage = shallowRef('')

const teamOptions = computed(() =>
  [...props.teams].sort((left, right) => {
    const groupDelta = (left.groupCode ?? '').localeCompare(right.groupCode ?? '', 'pl')
    return groupDelta || displayTeamName(left).localeCompare(displayTeamName(right), 'pl')
  }),
)
const validationMessage = computed(() => {
  if (!homeTeamId.value || !awayTeamId.value) {
    return 'Wybierz obie drużyny.'
  }

  if (homeTeamId.value === awayTeamId.value) {
    return 'Gospodarze i goście muszą być różnymi drużynami.'
  }

  return ''
})
const isDirty = computed(
  () => homeTeamId.value !== (props.match.homeTeamId ?? '') || awayTeamId.value !== (props.match.awayTeamId ?? ''),
)

watch(
  () => [props.match.homeTeamId, props.match.awayTeamId] as const,
  ([nextHomeTeamId, nextAwayTeamId]) => {
    homeTeamId.value = nextHomeTeamId ?? ''
    awayTeamId.value = nextAwayTeamId ?? ''
    errorMessage.value = ''
    successMessage.value = ''
  },
  { immediate: true },
)

function optionLabel(team: Team) {
  const groupLabel = team.groupCode ? `grupa ${team.groupCode}` : 'bez grupy'
  return `${displayTeamName(team)} · ${groupLabel}`
}

function swapTeams() {
  const previousHomeTeamId = homeTeamId.value
  homeTeamId.value = awayTeamId.value
  awayTeamId.value = previousHomeTeamId
  errorMessage.value = ''
  successMessage.value = ''
}

async function submitTeams() {
  errorMessage.value = ''
  successMessage.value = ''

  if (validationMessage.value) {
    errorMessage.value = validationMessage.value
    return
  }

  isSaving.value = true

  try {
    await setMatchTeams({
      matchId: props.match.id,
      homeTeamId: homeTeamId.value,
      awayTeamId: awayTeamId.value,
      reason: 'Ręczne przypisanie drużyn w panelu administratora',
    })
    successMessage.value = 'Drużyny meczu zostały zapisane.'
  } catch (error) {
    errorMessage.value = matchTeamsErrorMessage(error)
  } finally {
    isSaving.value = false
  }
}

function matchTeamsErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('admin_required')) {
    return 'Tylko administrator może przypisać drużyny.'
  }

  if (message.includes('match_team_change_conflicts_with_predictions')) {
    return 'Nie można zmienić ekip, ponieważ istnieją już typy strzelców dla innych drużyn.'
  }

  if (message.includes('match_result_already_confirmed')) {
    return 'Nie można zmienić ekip po zatwierdzeniu wyniku.'
  }

  if (message.includes('invalid_home_team') || message.includes('invalid_away_team')) {
    return 'Wybrana drużyna nie należy do tego turnieju.'
  }

  if (message.includes('invalid_match_teams')) {
    return 'Wybierz dwie różne drużyny.'
  }

  if (message.includes('set_match_teams_admin')) {
    return 'Brakuje funkcji set_match_teams_admin w Supabase.'
  }

  return message || 'Nie udało się zapisać drużyn meczu.'
}
</script>

<template>
  <section class="team-editor panel">
    <div class="team-editor-heading">
      <div>
        <span>{{ props.match.matchNumber ? `Mecz ${props.match.matchNumber}` : 'Mecz pucharowy' }}</span>
        <h3>Przypisz drużyny</h3>
      </div>
      <small>{{ props.match.homePlaceholder ?? 'Gospodarze' }} — {{ props.match.awayPlaceholder ?? 'Goście' }}</small>
    </div>

    <div class="team-editor-fields">
      <label class="team-field">
        <span>Gospodarze</span>
        <select v-model="homeTeamId" :disabled="isSaving">
          <option value="">Wybierz drużynę</option>
          <option v-for="team in teamOptions" :key="team.id" :value="team.id">{{ optionLabel(team) }}</option>
        </select>
      </label>

      <button class="swap-button" type="button" title="Zamień strony" :disabled="isSaving" @click="swapTeams">
        <ArrowLeftRight :size="18" aria-hidden="true" />
        <span>Zamień</span>
      </button>

      <label class="team-field">
        <span>Goście</span>
        <select v-model="awayTeamId" :disabled="isSaving">
          <option value="">Wybierz drużynę</option>
          <option v-for="team in teamOptions" :key="team.id" :value="team.id">{{ optionLabel(team) }}</option>
        </select>
      </label>
    </div>

    <p v-if="errorMessage" class="feedback feedback-error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="successMessage" class="feedback feedback-success" role="status">{{ successMessage }}</p>

    <button
      class="button-primary save-button"
      type="button"
      :disabled="isSaving || !isDirty || Boolean(validationMessage)"
      @click="submitTeams"
    >
      <Loader2 v-if="isSaving" :size="18" class="spinner" aria-hidden="true" />
      <Save v-else :size="18" aria-hidden="true" />
      {{ isSaving ? 'Zapisuję' : isDirty ? 'Zapisz drużyny' : 'Drużyny zapisane' }}
    </button>
  </section>
</template>

<style scoped>
.team-editor {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.team-editor-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.team-editor-heading div {
  display: grid;
  gap: 3px;
}

.team-editor-heading span,
.team-editor-heading small,
.team-field span {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
}

.team-editor-heading span,
.team-field span {
  text-transform: uppercase;
}

.team-editor-heading h3 {
  margin: 0;
  font-size: 18px;
}

.team-editor-heading small {
  max-width: 50%;
  text-align: right;
}

.team-editor-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  gap: 10px;
}

.team-field {
  display: grid;
  gap: 6px;
}

.team-field select {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  padding: 0 10px;
  color: var(--app-ink);
  font: inherit;
  font-size: 13px;
  font-weight: 800;
}

.swap-button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #f7faf6;
  padding: 0 12px;
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 950;
}

.feedback {
  margin: 0;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 850;
}

.feedback-error {
  background: #f9e7e4;
  color: var(--app-danger);
}

.feedback-success {
  background: #e7f4eb;
  color: var(--app-primary-dark);
}

.save-button {
  justify-content: center;
}

.save-button:disabled,
.swap-button:disabled,
.team-field select:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.spinner {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .team-editor-heading,
  .team-editor-fields {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .team-editor-heading {
    display: grid;
  }

  .team-editor-heading small {
    max-width: none;
    text-align: left;
  }
}
</style>
