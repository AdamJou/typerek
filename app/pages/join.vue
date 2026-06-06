<script setup lang="ts">
import { TicketCheck } from 'lucide-vue-next'
import { joinLeagueMutation } from '~/features/leagues/mutations/join-league-mutation'

const joinCode = shallowRef('')
const loading = shallowRef(false)
const errorMessage = shallowRef('')
const { refresh } = useTyperekData()

async function joinLeague() {
  loading.value = true
  errorMessage.value = ''

  try {
    await joinLeagueMutation(joinCode.value.trim())
    await refresh()
    await navigateTo('/league')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Nie udało się dołączyć do ligi.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="join-page">
    <div class="page-heading">
      <h1>Dołącz do ligi</h1>
      <p>Wpisz kod zaproszenia od organizatora, żeby dołączyć do typowania ze znajomymi.</p>
    </div>

    <form class="join-card panel" @submit.prevent="joinLeague">
      <label>
        <span class="eyeless-label">Kod zaproszenia</span>
        <input v-model="joinCode" class="input code-input" placeholder="np. WC26-ADAM" autocomplete="off" required />
      </label>
      <button class="button-primary" type="submit" :disabled="loading">
        <TicketCheck :size="18" aria-hidden="true" />
        {{ loading ? 'Dołączanie...' : 'Dołącz' }}
      </button>
      <p v-if="errorMessage" class="join-error">{{ errorMessage }}</p>
    </form>
  </section>
</template>

<style scoped>
.join-page,
.page-heading,
.join-card {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p,
.join-error {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(30px, 8vw, 48px);
  line-height: 1;
}

.page-heading p,
.join-error {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
}

.join-error {
  color: var(--app-danger);
}

.join-card {
  padding: 16px;
}

.code-input {
  text-transform: uppercase;
}
</style>
