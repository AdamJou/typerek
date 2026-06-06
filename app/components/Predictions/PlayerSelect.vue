<script setup lang="ts">
import { Check, ChevronDown, Search } from 'lucide-vue-next'
import type { Player, Team } from '~/types/domain'
import { displayPosition, displayTeamName, formatPlayerNameParts, sortPlayersForScorerSelect } from '~/utils/footballUi'

type PositionSectionKey = 'forwards' | 'midfielders' | 'others'

interface PlayerOption {
  player: Player
  team: Team
}

interface PlayerSection {
  key: PositionSectionKey
  label: string
  players: Player[]
}

const model = defineModel<string | null>({ required: true })

const props = defineProps<{
  players: readonly Player[]
  teams: readonly Team[]
  disabled?: boolean
  label?: string
  placeholder?: string
  emptyLabel?: string
}>()

const rootRef = useTemplateRef<HTMLElement>('rootRef')
const searchInputRef = useTemplateRef<HTMLInputElement>('searchInputRef')
const isOpen = shallowRef(false)
const searchQuery = shallowRef('')
const activeIndex = shallowRef(0)

const isDisabled = computed(() => props.disabled || props.players.length === 0)
const selectedPlayer = computed(() => props.players.find((player) => player.id === model.value) ?? null)
const selectedTeam = computed(() => props.teams.find((team) => team.id === selectedPlayer.value?.teamId))
const groupedPlayers = computed(() =>
  props.teams
    .map((team) => ({
      team,
      sections: positionSections(
        sortPlayersForScorerSelect(props.players.filter((player) => player.teamId === team.id)).filter((player) =>
          matchesSearch(player, team),
        ),
      ),
    }))
    .filter((group) => group.sections.some((section) => section.players.length > 0)),
)
const flatOptions = computed<PlayerOption[]>(() =>
  groupedPlayers.value.flatMap((group) =>
    group.sections.flatMap((section) => section.players.map((player) => ({ player, team: group.team }))),
  ),
)
const triggerLabel = computed(() => {
  if (selectedPlayer.value) {
    return ''
  }

  return isDisabled.value ? (props.emptyLabel ?? 'Brak zawodników') : (props.placeholder ?? 'Wybierz zawodnika')
})
const selectedPlayerName = computed(() => (selectedPlayer.value ? formatPlayerNameParts(selectedPlayer.value.name) : null))
const selectedMeta = computed(() => {
  if (!selectedPlayer.value) {
    return props.label ?? 'Pierwszy strzelec'
  }

  return [displayPosition(selectedPlayer.value.position), selectedTeam.value ? displayTeamName(selectedTeam.value) : null]
    .filter(Boolean)
    .join(' · ')
})

watch(searchQuery, () => {
  activeIndex.value = 0
})

watch(flatOptions, (options) => {
  if (activeIndex.value >= options.length) {
    activeIndex.value = Math.max(0, options.length - 1)
  }
})

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      closeDropdown()
    }
  },
)

function positionSections(players: Player[]): PlayerSection[] {
  const sections: Record<PositionSectionKey, Player[]> = {
    forwards: [],
    midfielders: [],
    others: [],
  }

  for (const player of players) {
    sections[positionSectionKey(player.position)].push(player)
  }

  const orderedSections: PlayerSection[] = [
    { key: 'forwards', label: 'Napastnicy', players: sections.forwards },
    { key: 'midfielders', label: 'Pomocnicy', players: sections.midfielders },
    { key: 'others', label: 'Pozostali', players: sections.others },
  ]

  return orderedSections.filter((section) => section.players.length > 0)
}

function positionSectionKey(position: string | null | undefined): PositionSectionKey {
  const normalized = position?.toLowerCase() ?? ''

  if (['forward', 'fw', 'striker'].includes(normalized)) {
    return 'forwards'
  }

  if (['midfielder', 'mf'].includes(normalized)) {
    return 'midfielders'
  }

  return 'others'
}

function matchesSearch(player: Player, team: Team) {
  const query = normalizeSearch(searchQuery.value)

  if (!query) {
    return true
  }

  return normalizeSearch(`${player.name} ${displayPosition(player.position)} ${displayTeamName(team)}`).includes(query)
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function nameParts(player: Player) {
  return formatPlayerNameParts(player.name)
}

function playerMeta(player: Player, team: Team) {
  return [player.shirtNumber ? `#${player.shirtNumber}` : null, displayPosition(player.position), displayTeamName(team)]
    .filter(Boolean)
    .join(' · ')
}

function openDropdown() {
  if (isDisabled.value) {
    return
  }

  isOpen.value = true
  searchQuery.value = ''
  const selectedIndex = flatOptions.value.findIndex((option) => option.player.id === model.value)
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : 0

  void nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function closeDropdown() {
  isOpen.value = false
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown()
    return
  }

  openDropdown()
}

function selectPlayer(playerId: string | null) {
  model.value = playerId
  closeDropdown()
}

function moveActive(direction: 1 | -1) {
  if (!isOpen.value) {
    openDropdown()
    return
  }

  const optionsLength = flatOptions.value.length

  if (optionsLength === 0) {
    return
  }

  activeIndex.value = (activeIndex.value + direction + optionsLength) % optionsLength
}

function selectActive() {
  const option = flatOptions.value[activeIndex.value]

  if (option) {
    selectPlayer(option.player.id)
  }
}

function isActive(playerId: string) {
  return flatOptions.value[activeIndex.value]?.player.id === playerId
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
    event.preventDefault()
    openDropdown()
  }
}

function onListKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActive(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(-1)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    selectActive()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeDropdown()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <div ref="rootRef" class="player-select" :class="{ 'is-open': isOpen, 'is-disabled': isDisabled }">
    <span class="eyeless-label">{{ props.label ?? 'Pierwszy strzelec' }}</span>

    <button
      class="player-select-trigger"
      type="button"
      :disabled="isDisabled"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="toggleDropdown"
      @keydown="onTriggerKeydown"
    >
      <span class="trigger-copy">
        <span v-if="selectedPlayerName" class="trigger-player-name">
          <span v-if="selectedPlayerName.givenInitial">{{ selectedPlayerName.givenInitial }}</span>
          <strong>{{ selectedPlayerName.surname }}</strong>
        </span>
        <strong v-else>{{ triggerLabel }}</strong>
        <small>{{ selectedMeta }}</small>
      </span>
      <ChevronDown :size="18" aria-hidden="true" />
    </button>

    <div v-if="isOpen" class="player-select-popover" @keydown="onListKeydown">
      <label class="player-search">
        <Search :size="16" aria-hidden="true" />
        <input ref="searchInputRef" v-model="searchQuery" type="search" placeholder="Szukaj zawodnika" autocomplete="off" />
      </label>

      <button v-if="model" class="clear-option" type="button" @click="selectPlayer(null)">
        Wyczyść wybór
      </button>

      <div v-if="flatOptions.length" class="player-list" role="listbox">
        <section v-for="group in groupedPlayers" :key="group.team.id" class="team-group">
          <h3>{{ displayTeamName(group.team) }}</h3>

          <div v-for="section in group.sections" :key="`${group.team.id}-${section.key}`" class="position-group">
            <span class="position-heading">{{ section.label }}</span>

            <button
              v-for="player in section.players"
              :key="player.id"
              class="player-option"
              :class="{ 'is-selected': player.id === model, 'is-active': isActive(player.id) }"
              type="button"
              role="option"
              :aria-selected="player.id === model"
              @click="selectPlayer(player.id)"
            >
              <span class="player-name">
                <span v-if="nameParts(player).givenInitial">{{ nameParts(player).givenInitial }}</span>
                <strong>{{ nameParts(player).surname }}</strong>
              </span>
              <small>{{ playerMeta(player, group.team) }}</small>
              <Check v-if="player.id === model" :size="16" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      <p v-else class="empty-options">Nie znaleziono zawodnika.</p>
    </div>
  </div>
</template>

<style scoped>
.player-select {
  position: relative;
  display: grid;
  min-width: 0;
  max-width: 100%;
}

.player-select-trigger {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f8fbf7);
  padding: 8px 10px;
  color: var(--app-ink);
  text-align: left;
  outline: none;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.player-select-trigger:hover {
  border-color: rgba(12, 107, 70, 0.28);
}

.player-select-trigger:focus-visible,
.player-select.is-open .player-select-trigger {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px rgba(12, 107, 70, 0.12);
}

.player-select-trigger:disabled {
  cursor: not-allowed;
  background: #f3f4f0;
  color: var(--app-muted);
}

.trigger-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.trigger-copy strong {
  overflow: hidden;
  font-size: 14px;
  font-weight: 950;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-player-name {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  gap: 4px;
}

.trigger-player-name span {
  flex: 0 0 auto;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 600;
}

.trigger-player-name strong {
  min-width: 0;
}

.trigger-copy small {
  overflow: hidden;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-select-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 20;
  display: grid;
  gap: 8px;
  border: 1px solid rgba(190, 205, 194, 0.95);
  border-radius: 8px;
  background: white;
  box-shadow: 0 20px 52px rgba(26, 42, 34, 0.18);
  padding: 10px;
}

.player-search {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: #f8fbf7;
  padding: 0 10px;
  color: var(--app-muted);
}

.player-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--app-ink);
  font-size: 14px;
  font-weight: 800;
  outline: none;
}

.clear-option {
  min-height: 34px;
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: white;
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 900;
}

.player-list {
  display: grid;
  max-height: 320px;
  gap: 10px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.team-group {
  display: grid;
  gap: 7px;
}

.team-group h3 {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  border-radius: 7px;
  background: #eef4ef;
  padding: 7px 9px;
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 950;
}

.position-group {
  display: grid;
  gap: 5px;
}

.position-heading {
  padding-inline: 4px;
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.player-option {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 3px 8px;
  min-height: 48px;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #fbfdf9;
  padding: 8px 10px;
  color: var(--app-ink);
  text-align: left;
}

.player-option:hover,
.player-option.is-active {
  border-color: rgba(12, 107, 70, 0.24);
  background: #eef6f0;
}

.player-option.is-selected {
  border-color: rgba(12, 107, 70, 0.38);
  background: #e7f4eb;
}

.player-name {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 4px;
}

.player-name span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-name strong {
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 950;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-option small {
  grid-column: 1 / -1;
  min-width: 0;
  overflow: hidden;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-option svg {
  color: var(--app-primary);
}

.empty-options {
  margin: 0;
  border: 1px dashed var(--app-line);
  border-radius: 8px;
  padding: 12px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

@media (max-width: 520px) {
  .player-select-popover {
    position: fixed;
    top: auto;
    right: 12px;
    bottom: 82px;
    left: 12px;
    max-height: min(72dvh, 560px);
  }

  .player-list {
    max-height: min(50dvh, 420px);
  }
}
</style>
