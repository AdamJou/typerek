<script setup lang="ts">
import { Minus, Plus, Trash2 } from 'lucide-vue-next'
import type { Player, Team, TournamentStage } from '~/types/domain'
import { displayTeamName } from '~/utils/footballUi'
import {
  answerPreview,
  duelOptions,
  emptyGroupAnswer,
  fixedSubjectLabel,
  groupedTeams,
  normalizeBonusNumericValue,
  optionsForQuestion,
  questionKindLabel,
  stageOptions,
  type ResolvedBonusQuestion,
} from '~/utils/bonus'

const model = defineModel<Record<string, unknown> | null>({ required: true })

const props = defineProps<{
  question: ResolvedBonusQuestion
  teams: readonly Team[]
  players: readonly Player[]
  stages: readonly TournamentStage[]
  disabled?: boolean
}>()

const topFourPickerId = shallowRef<string | null>(null)

const entityOptions = computed(() => optionsForQuestion(props.question, props.teams, props.players))
const duelChoiceOptions = computed(() => duelOptions(props.question, props.teams, props.players))
const stageChoiceOptions = computed(() => stageOptions(props.stages))
const fixedLabel = computed(() => fixedSubjectLabel(props.question, props.teams, props.players))
const groupMap = computed(() => groupedTeams(props.teams))
const groupAnswers = computed(() => {
  const rawGroups = Array.isArray(model.value?.groups) ? model.value?.groups : emptyGroupAnswer(props.teams)
  return rawGroups as Array<{ groupCode: string; orderedTeamIds: string[] }>
})
const topFourTeamIds = computed(() => {
  const ids = Array.isArray(model.value?.orderedTeamIds) ? (model.value?.orderedTeamIds as string[]) : []
  return ids.filter((teamId) => props.teams.some((team) => team.id === teamId)).slice(0, 4)
})
const remainingTopFourOptions = computed(() =>
  entityOptions.value.filter((option) => !topFourTeamIds.value.includes(option.id)),
)

function setAnswer(next: Record<string, unknown> | null) {
  model.value = next
}

function setBoolean(value: boolean) {
  setAnswer({ value })
}

function setNumericValue(value: string | number) {
  const maxValue = typeof props.question.configJson.maxValue === 'number' ? props.question.configJson.maxValue : 99
  const nextValue = normalizeBonusNumericValue(value, maxValue)
  setAnswer(nextValue === null ? null : { value: nextValue })
}

function stepNumeric(delta: number) {
  const current = typeof model.value?.value === 'number' ? model.value.value : 0
  setNumericValue(current + delta)
}

function setTeamId(teamId: string | null) {
  setAnswer(teamId ? { teamId } : null)
}

function setPlayerId(playerId: string | null) {
  setAnswer(playerId ? { playerId } : null)
}

function setStageCode(stageCode: string) {
  setAnswer(stageCode ? { stageCode } : null)
}

function setWinnerKey(winnerKey: string | null) {
  setAnswer(winnerKey ? { winnerKey } : null)
}

function setTopFourIds(orderedTeamIds: string[]) {
  setAnswer({ orderedTeamIds: orderedTeamIds.slice(0, 4) })
}

function addTopFourTeam(teamId: string | null) {
  if (!teamId || topFourTeamIds.value.includes(teamId) || topFourTeamIds.value.length >= 4) {
    topFourPickerId.value = null
    return
  }

  setTopFourIds([...topFourTeamIds.value, teamId])
  topFourPickerId.value = null
}

function removeTopFourTeam(teamId: string) {
  setTopFourIds(topFourTeamIds.value.filter((value) => value !== teamId))
}

function setGroupOrder(groupCode: string, orderedTeamIds: string[]) {
  const nextGroups = groupAnswers.value.map((group) => (group.groupCode === groupCode ? { ...group, orderedTeamIds } : group))
  setAnswer({ groups: nextGroups })
}

function resetGroups() {
  setAnswer({ groups: emptyGroupAnswer(props.teams) })
}
</script>

<template>
  <div class="answer-field">
    <div v-if="fixedLabel" class="subject-chip">
      <span class="subject-label">{{ questionKindLabel(question.kind) }}</span>
      <strong>{{ fixedLabel }}</strong>
    </div>

    <div v-if="question.kind === 'boolean'" class="boolean-grid">
      <button class="segment-button" type="button" :data-selected="model?.value === true" :disabled="disabled" @click="setBoolean(true)">
        Tak
      </button>
      <button class="segment-button" type="button" :data-selected="model?.value === false" :disabled="disabled" @click="setBoolean(false)">
        Nie
      </button>
    </div>

    <div v-else-if="['numeric', 'player_numeric', 'team_numeric'].includes(question.kind)" class="numeric-shell">
      <button class="step-button" type="button" :disabled="disabled" @click="stepNumeric(-1)">
        <Minus :size="16" aria-hidden="true" />
      </button>
      <input
        class="numeric-input"
        :disabled="disabled"
        type="number"
        min="0"
        :max="question.configJson.maxValue ?? 99"
        :value="typeof model?.value === 'number' ? model.value : ''"
        @input="setNumericValue(($event.target as HTMLInputElement).value)"
      />
      <button class="step-button" type="button" :disabled="disabled" @click="stepNumeric(1)">
        <Plus :size="16" aria-hidden="true" />
      </button>
    </div>

    <BonusEntityPicker
      v-else-if="question.kind === 'team_single'"
      :model-value="typeof model?.teamId === 'string' ? model.teamId : null"
      :options="entityOptions"
      placeholder="Wybierz drużynę"
      :disabled="disabled"
      @update:model-value="setTeamId"
    />

    <BonusEntityPicker
      v-else-if="question.kind === 'player_single'"
      :model-value="typeof model?.playerId === 'string' ? model.playerId : null"
      :options="entityOptions"
      placeholder="Wybierz zawodnika"
      :disabled="disabled"
      @update:model-value="setPlayerId"
    />

    <label v-else-if="question.kind === 'team_stage_exit'" class="stage-select">
      <span>Etap odpadnięcia</span>
      <span class="select-shell">
        <select :disabled="disabled" :value="typeof model?.stageCode === 'string' ? model.stageCode : ''" @change="setStageCode(($event.target as HTMLSelectElement).value)">
          <option value="">Wybierz etap</option>
          <option v-for="option in stageChoiceOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </span>
    </label>

    <BonusDuelPicker
      v-else-if="['duel_player', 'duel_team', 'comparison_numeric'].includes(question.kind)"
      :model-value="typeof model?.winnerKey === 'string' ? model.winnerKey : null"
      :options="duelChoiceOptions"
      :disabled="disabled"
      @update:model-value="setWinnerKey"
    />

    <div v-else-if="question.kind === 'ranked_top4'" class="top-four-builder">
      <div class="top-four-toolbar">
        <BonusEntityPicker
          :model-value="topFourPickerId"
          :options="remainingTopFourOptions"
          placeholder="Dodaj drużynę do top 4"
          empty-label="Wszystkie sloty są zajęte albo brakuje drużyn."
          :disabled="disabled || topFourTeamIds.length >= 4"
          @update:model-value="addTopFourTeam"
        />
      </div>

      <BonusSortableTeams
        v-if="topFourTeamIds.length"
        :model-value="topFourTeamIds"
        title="Kolejność 1–4"
        :teams="teams.filter((team) => topFourTeamIds.includes(team.id))"
        :disabled="disabled"
        @update:model-value="setTopFourIds"
      />

      <div v-if="topFourTeamIds.length" class="top-four-remove-list">
        <button v-for="teamId in topFourTeamIds" :key="teamId" class="remove-chip" type="button" :disabled="disabled" @click="removeTopFourTeam(teamId)">
          <span>{{ displayTeamName(teams.find((team) => team.id === teamId)) }}</span>
          <Trash2 :size="14" aria-hidden="true" />
        </button>
      </div>

      <p v-else class="helper-copy">Dodaj cztery drużyny i ustaw ich kolejność przeciąganiem.</p>
    </div>

    <div v-else-if="question.kind === 'ranked_group_table'" class="groups-builder">
      <div class="groups-toolbar">
        <p>Ustaw kolejność 1–4 w każdej grupie. Przeciągaj drużyny, aby zmienić miejsca.</p>
        <button class="reset-groups-button" type="button" :disabled="disabled" @click="resetGroups">Reset grup</button>
      </div>

      <div class="groups-grid">
        <BonusSortableTeams
          v-for="group in groupAnswers"
          :key="group.groupCode"
          :model-value="group.orderedTeamIds"
          :title="`Grupa ${group.groupCode}`"
          :teams="groupMap[group.groupCode] ?? []"
          :disabled="disabled"
          compact
          @update:model-value="setGroupOrder(group.groupCode, $event)"
        />
      </div>
    </div>

    <p v-else class="helper-copy">{{ answerPreview(question, model, teams, players) }}</p>

    <p v-if="question.configJson.helperText" class="helper-copy">{{ question.configJson.helperText }}</p>
  </div>
</template>

<style scoped>
.answer-field,
.boolean-grid,
.subject-chip,
.stage-select,
.top-four-builder,
.groups-builder,
.groups-toolbar,
.groups-grid,
.top-four-remove-list {
  display: grid;
  gap: 12px;
}

.subject-chip {
  gap: 4px;
  border: 1px solid rgba(19, 125, 78, 0.16);
  border-radius: 8px;
  background: rgba(19, 125, 78, 0.06);
  padding: 10px 12px;
}

.subject-label,
.stage-select > span:first-child {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.subject-chip strong {
  font-size: 15px;
  font-weight: 900;
}

.boolean-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.segment-button,
.step-button,
.reset-groups-button,
.remove-chip {
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  color: var(--app-ink);
}

.segment-button {
  min-height: 46px;
  font-size: 14px;
  font-weight: 900;
}

.segment-button[data-selected='true'] {
  border-color: rgba(19, 125, 78, 0.35);
  background: rgba(19, 125, 78, 0.08);
  color: var(--app-primary-dark);
}

.numeric-shell {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  align-items: stretch;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  overflow: hidden;
}

.step-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border: 0;
  border-right: 1px solid var(--app-line);
  border-radius: 0;
  background: #f6faf7;
}

.step-button:last-child {
  border-right: 0;
  border-left: 1px solid var(--app-line);
}

.numeric-input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: white;
  color: var(--app-ink);
  font: inherit;
  font-size: 28px;
  font-weight: 950;
  text-align: center;
}

.stage-select {
  gap: 6px;
}

.select-shell {
  position: relative;
  display: flex;
  min-height: 46px;
  align-items: center;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fbf7);
  overflow: hidden;
}

.select-shell select {
  width: 100%;
  min-width: 0;
  height: 100%;
  appearance: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--app-ink);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 900;
  padding: 0 12px;
}

.helper-copy,
.groups-toolbar p {
  margin: 0;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.groups-toolbar {
  align-items: start;
}

.reset-groups-button {
  min-height: 38px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 900;
}

.groups-grid {
  grid-template-columns: 1fr;
}

.top-four-remove-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.remove-chip {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 800;
}

@media (max-width: 720px) {
  .groups-grid,
  .top-four-remove-list {
    grid-template-columns: 1fr;
  }
}
</style>
