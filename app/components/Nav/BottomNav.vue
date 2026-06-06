<script setup lang="ts">
import { ListChecks, Medal, Settings, Shield, TicketCheck, Trophy } from 'lucide-vue-next'

const { isAdmin } = useAuth()
const { hasLeague } = useTyperekData()
const { currentStagePendingCount } = usePendingPredictions()
const leagueItems = computed(() => [
  { to: '/league', label: 'Liga', icon: Shield },
  { to: '/matches', label: 'Mecze', icon: ListChecks, badge: currentStagePendingCount.value },
  { to: '/rankings', label: 'Ranking', icon: Medal },
  { to: '/results', label: 'Wyniki', icon: Trophy },
  ...(isAdmin.value ? [{ to: '/admin/sync', label: 'Ustawienia', icon: Settings }] : []),
])
const joinItems = [
  { to: '/league', label: 'Liga', icon: Shield },
  { to: '/join', label: 'Dołącz', icon: TicketCheck },
]
const items = computed(() => (hasLeague.value ? leagueItems.value : joinItems))
</script>

<template>
  <nav class="bottom-nav" :style="{ '--nav-count': items.length }" aria-label="Główna nawigacja">
    <NuxtLink v-for="item in items" :key="item.to" class="bottom-nav-item" :to="item.to">
      <span v-if="'badge' in item && item.badge" class="bottom-nav-badge">{{ item.badge }}</span>
      <component :is="item.icon" :size="20" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  right: 12px;
  bottom: 12px;
  left: 12px;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(var(--nav-count), 1fr);
  border: 1px solid rgba(190, 205, 194, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 38px rgba(28, 43, 35, 0.18);
  backdrop-filter: blur(16px);
}

.bottom-nav-item {
  position: relative;
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  padding: 6px 2px 5px;
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.bottom-nav-badge {
  position: absolute;
  top: 5px;
  right: max(8px, calc(50% - 22px));
  display: inline-flex;
  min-width: 17px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  border-radius: 999px;
  background: var(--app-danger);
  padding-inline: 3px;
  color: white;
  font-size: 9px;
  font-weight: 900;
  line-height: 1;
}

.bottom-nav-item.router-link-active {
  color: var(--app-primary);
}

@media (min-width: 740px) {
  .bottom-nav {
    display: none;
  }
}
</style>
