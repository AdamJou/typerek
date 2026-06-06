<script setup lang="ts">
import type { LeagueMember } from '~/types/domain'

const props = withDefaults(
  defineProps<{
    members: readonly LeagueMember[]
    limit?: number
  }>(),
  {
    limit: 12,
  },
)

const colors = ['#0c6b46', '#2878d0', '#7656e8', '#d9822b', '#c44569', '#168c8c', '#59636e', '#8b5e3c']
const visibleMembers = computed(() => {
  const visibleLimit = props.members.length > props.limit ? Math.max(0, props.limit - 1) : props.limit

  return props.members.slice(0, visibleLimit)
})
const hiddenCount = computed(() => Math.max(0, props.members.length - visibleMembers.value.length))
const participantsLabel = computed(() => `Typ oddali: ${props.members.map((member) => member.displayName).join(', ')}`)

function initials(displayName: string) {
  return Array.from(displayName.trim()).slice(0, 2).join('').toLocaleUpperCase('pl-PL') || '?'
}

function memberColor(member: LeagueMember) {
  const hash = Array.from(member.userId || member.displayName).reduce(
    (value, character) => ((value << 5) - value + character.codePointAt(0)!) | 0,
    0,
  )

  return colors[Math.abs(hash) % colors.length]
}
</script>

<template>
  <div v-if="props.members.length" class="prediction-participants" :aria-label="participantsLabel">
    <span class="participants-label">Typowali</span>

    <div class="participant-stack" aria-hidden="true">
      <span
        v-for="member in visibleMembers"
        :key="member.userId"
        class="participant-avatar"
        :style="{ backgroundColor: memberColor(member) }"
        :title="member.displayName"
      >
        {{ initials(member.displayName) }}
      </span>
      <span v-if="hiddenCount" class="participant-avatar participant-more">+{{ hiddenCount }}</span>
    </div>
  </div>
</template>

<style scoped>
.prediction-participants {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  border-top: 1px solid rgba(223, 230, 221, 0.8);
  padding-top: 11px;
}

.participants-label {
  flex: 0 0 auto;
  color: var(--app-muted);
  font-size: 10px;
  font-weight: 950;
  text-transform: uppercase;
}

.participant-stack {
  display: flex;
  min-width: 0;
  align-items: center;
  padding-left: 1px;
}

.participant-avatar {
  display: inline-flex;
  flex: 0 0 29px;
  width: 29px;
  height: 29px;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  border-radius: 50%;
  color: white;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: -0.02em;
  box-shadow: 0 1px 3px rgba(20, 33, 27, 0.16);
}

.participant-avatar + .participant-avatar {
  margin-left: -10px;
}

.participant-more {
  background: var(--app-primary-dark);
  font-size: 9px;
}

@media (max-width: 380px) {
  .prediction-participants {
    gap: 6px;
  }

  .participant-avatar {
    flex-basis: 27px;
    width: 27px;
    height: 27px;
    font-size: 9px;
  }

  .participant-avatar + .participant-avatar {
    margin-left: -10px;
  }
}
</style>
