<script setup lang="ts">
import { MailCheck, UserPlus } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
  auth: false,
})

const email = shallowRef('')
const displayName = shallowRef('')
const password = shallowRef('')
const passwordRepeat = shallowRef('')
const errorMessage = shallowRef('')
const loading = shallowRef(false)
const confirmationEmail = shallowRef('')
const { init, isAuthenticated, register, isConfigured } = useAuth()

await init()

if (isAuthenticated.value) {
  await navigateTo('/league')
}

async function submit() {
  errorMessage.value = ''

  if (password.value !== passwordRepeat.value) {
    errorMessage.value = 'Hasła nie są takie same.'
    return
  }

  loading.value = true

  try {
    const result = await register({ email: email.value, password: password.value, displayName: displayName.value })

    if (result.requiresEmailConfirmation) {
      confirmationEmail.value = email.value.trim()
      password.value = ''
      passwordRepeat.value = ''
      return
    }

    await navigateTo('/join')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Nie udało się utworzyć konta.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section v-if="confirmationEmail" class="confirmation-panel">
    <div class="confirmation-icon" aria-hidden="true">
      <MailCheck :size="30" />
    </div>

    <div class="auth-copy">
      <h1>Potwierdź adres email</h1>
      <p>
        Wysłaliśmy link aktywacyjny na <strong>{{ confirmationEmail }}</strong>.
        Otwórz wiadomość i kliknij link, aby aktywować konto.
      </p>
    </div>

    <p class="confirmation-note">
      Jeśli wiadomości nie ma w skrzynce odbiorczej, sprawdź folder spam. Po potwierdzeniu możesz się zalogować.
    </p>

    <NuxtLink class="button-primary confirmation-action" to="/auth/login">Przejdź do logowania</NuxtLink>
  </section>

  <form v-else class="auth-form" @submit.prevent="submit">
    <div class="auth-copy">
      <h1>Utwórz konto</h1>
      <p>Podaj email, hasło i nick widoczny w lidze. Po rejestracji wyślemy link aktywacyjny na Twój email.</p>
    </div>

    <p v-if="!isConfigured" class="demo-note">
      Rejestracja jest chwilowo niedostępna.
    </p>

    <label>
      <span class="eyeless-label">Email</span>
      <input v-model="email" class="input" type="email" autocomplete="email" required />
    </label>

    <label>
      <span class="eyeless-label">Nick w lidze</span>
      <input v-model="displayName" class="input" autocomplete="nickname" minlength="2" maxlength="32" required />
    </label>

    <PasswordInput
      v-model="password"
      label="Hasło"
      autocomplete="new-password"
      :minlength="8"
    />

    <PasswordInput
      v-model="passwordRepeat"
      label="Powtórz hasło"
      autocomplete="new-password"
      :minlength="8"
    />

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <button class="button-primary" type="submit" :disabled="loading">
      <UserPlus :size="18" aria-hidden="true" />
      {{ loading ? 'Tworzenie...' : 'Zarejestruj' }}
    </button>

    <NuxtLink class="auth-link" to="/auth/login">Masz konto? Zaloguj się</NuxtLink>
  </form>
</template>

<style scoped>
.auth-form {
  display: grid;
  gap: 14px;
}

.confirmation-panel {
  display: grid;
  justify-items: center;
  gap: 18px;
  text-align: center;
}

.confirmation-icon {
  display: inline-flex;
  width: 58px;
  height: 58px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--app-surface-strong);
  color: var(--app-primary);
}

.auth-copy {
  display: grid;
  gap: 6px;
}

.auth-copy h1,
.auth-copy p,
.confirmation-note,
.error-message,
.demo-note {
  margin: 0;
}

.auth-copy h1 {
  font-size: 28px;
  line-height: 1.05;
}

.auth-copy p,
.confirmation-note,
.demo-note {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
}

.auth-copy strong {
  color: var(--app-ink);
}

.confirmation-note {
  border: 1px solid var(--app-line);
  border-radius: 7px;
  background: var(--app-bg);
  padding: 12px;
}

.confirmation-action {
  width: 100%;
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
