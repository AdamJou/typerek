<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { Team } from '~/types/domain'
import { displayTeamName, getTeamFlag } from '~/utils/footballUi'

const model = defineModel<string | null>({ required: true })

const props = withDefaults(defineProps<{
  teams: readonly Team[]
  disabled?: boolean
  label?: string
  helper?: string
}>(), {
  disabled: false,
  label: 'Kto awansuje dalej?',
  helper: 'Wybierz drużynę, która przejdzie do kolejnej rundy.',
})
</script>

<template>
  <fieldset class="advancement-picker" :disabled="props.disabled">
    <legend>{{ props.label }}</legend>
    <p>{{ props.helper }}</p>

    <div class="advancement-options">
      <button
        v-for="team in props.teams"
        :key="team.id"
        class="advancement-option"
        :class="{ 'is-selected': model === team.id }"
        type="button"
        :aria-pressed="model === team.id"
        @click="model = team.id"
      >
        <span class="team-flag" aria-hidden="true">
          <img v-if="getTeamFlag(team).src" :src="getTeamFlag(team).src || ''" alt="" />
          <span v-else>{{ getTeamFlag(team).emoji }}</span>
        </span>
        <strong>{{ displayTeamName(team) }}</strong>
        <Check v-if="model === team.id" :size="18" aria-hidden="true" />
      </button>
    </div>
  </fieldset>
</template>

<style scoped>
.advancement-picker {
  display: grid;
  gap: 8px;
  min-width: 0;
  border: 1px solid #d7e7da;
  border-radius: 9px;
  background: #f7fbf6;
  padding: 14px;
}

.advancement-picker legend {
  padding: 0 5px;
  color: var(--app-ink);
  font-size: 14px;
  font-weight: 950;
}

.advancement-picker p {
  margin: 0;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 750;
  line-height: 1.4;
}

.advancement-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.advancement-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-height: 48px;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  padding: 7px 10px;
  color: var(--app-ink);
  text-align: left;
}

.advancement-option.is-selected {
  border-color: var(--app-primary);
  background: #e8f4eb;
  color: var(--app-primary-dark);
}

.team-flag {
  display: inline-flex;
  width: 28px;
  height: 21px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 4px;
}

.team-flag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.advancement-option strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.advancement-picker:disabled {
  opacity: 0.62;
}

@media (max-width: 520px) {
  .advancement-options {
    grid-template-columns: 1fr;
  }
}
</style>
