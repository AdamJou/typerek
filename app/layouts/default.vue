<script setup lang="ts">
import { LogOut, Settings } from 'lucide-vue-next'

const { displayName, init, isAdmin, logout } = useAuth()
const { currentStageRanking, currentUserId } = useTyperekData()

const currentStagePosition = computed(() => {
  if (!currentUserId.value) {
    return null
  }

  return currentStageRanking.value.find((row) => row.userId === currentUserId.value)?.position ?? null
})

await init()
</script>

<template>
  <div class="app-layout">
    <header class="topbar">
      <div class="container-page topbar-inner">
        <NuxtLink class="brand" to="/league" aria-label="Typerek MŚ 2026">
          <AppLogo />
        </NuxtLink>

        <div class="topbar-actions">
          <span class="session-label">
            {{ displayName }}
            <span v-if="currentStagePosition !== null" class="session-rank">#{{ currentStagePosition }}</span>
          </span>
          <NuxtLink v-if="isAdmin" class="admin-link" to="/admin/sync" title="Ustawienia">
            <Settings :size="18" aria-hidden="true" />
          </NuxtLink>
          <button class="logout-button" type="button" title="Wyloguj" @click="logout">
            <LogOut :size="18" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>

    <main class="container-page main-content">
      <slot />
    </main>

    <BottomNav />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100dvh;
  padding-bottom: 88px;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid rgba(223, 230, 221, 0.78);
  background: rgba(247, 248, 243, 0.88);
  backdrop-filter: blur(16px);
}

.topbar-inner {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: inline-flex;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-link,
.logout-button {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: white;
  color: var(--app-ink);
}

.logout-button {
  padding: 0;
}

.session-label {
  display: none;
  align-items: center;
  gap: 8px;
  max-width: 220px;
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-rank {
  color: var(--app-primary-dark);
  font-weight: 900;
}

.main-content {
  padding-block: 24px 40px;
}

@media (min-width: 740px) {
  .app-layout {
    padding-bottom: 0;
  }

  .session-label {
    display: inline-flex;
  }

  .main-content {
    padding-block: 32px 56px;
  }
}
</style>
