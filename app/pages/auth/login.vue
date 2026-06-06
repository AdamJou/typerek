<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
  auth: false,
})

const email = shallowRef('')
const password = shallowRef('')
const errorMessage = shallowRef('')
const loading = shallowRef(false)
const { init, isAuthenticated, login, isConfigured } = useAuth()

await init()

if (isAuthenticated.value) {
  await navigateTo('/league')
}

async function submit() {
  loading.value = true
  errorMessage.value = ''

  try {
    await login({ email: email.value, password: password.value })
    await navigateTo('/league')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Nie udało się zalogować.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="auth-form" @submit.prevent="submit">
    <div class="auth-copy">
      <h1>Zaloguj się</h1>
      <p>Wejdź do prywatnej ligi i typuj mecze MŚ 2026.</p>
    </div>

    <p v-if="!isConfigured" class="demo-note">
      Logowanie jest chwilowo niedostępne.
    </p>

    <label>
      <span class="eyeless-label">Email</span>
      <input v-model="email" class="input" type="email" autocomplete="email" required />
    </label>

    <label>
      <span class="eyeless-label">Hasło</span>
      <input v-model="password" class="input" type="password" autocomplete="current-password" required />
    </label>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <button class="button-primary" type="submit" :disabled="loading">
      <LogIn :size="18" aria-hidden="true" />
      {{ loading ? 'Logowanie...' : 'Zaloguj' }}
    </button>

    <NuxtLink class="auth-link" to="/auth/register">Nie masz konta? Zarejestruj się</NuxtLink>
  </form>
</template>

<style scoped>
.auth-form {
  display: grid;
  gap: 14px;
}

.auth-copy {
  display: grid;
  gap: 6px;
}

.auth-copy h1,
.auth-copy p,
.error-message,
.demo-note {
  margin: 0;
}

.auth-copy h1 {
  font-size: 28px;
  line-height: 1.05;
}

.auth-copy p,
.demo-note {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
}

.demo-note {
  border: 1px solid #f0d58e;
  border-radius: 7px;
  background: #fff7df;
  padding: 10px;
  color: #735712;
}

.error-message {
  color: var(--app-danger);
  font-size: 13px;
  font-weight: 800;
}

.auth-link {
  justify-self: center;
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 800;
}
</style>
