<script setup lang="ts">
import { Save } from 'lucide-vue-next'

const { profileDisplayName, updateProfile, user } = useAuth()
const displayName = shallowRef('')
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
const loading = shallowRef(false)
const message = shallowRef('')
const errorMessage = shallowRef('')

watchEffect(() => {
  if (!displayName.value) {
    displayName.value = profileDisplayName.value ?? user.value?.email?.split('@')[0] ?? ''
  }
})

async function saveProfile() {
  loading.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    await updateProfile({ displayName: displayName.value, timezone })
    message.value = 'Profil zapisany.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Nie udało się zapisać profilu.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="profile-page">
    <div class="page-heading">
      <h1>Profil</h1>
      <p>Nick jest widoczny w lidze i rankingach zamiast adresu email.</p>
    </div>

    <form class="profile-form panel" @submit.prevent="saveProfile">
      <label>
        <span class="eyeless-label">Nick w lidze</span>
        <input v-model="displayName" class="input" minlength="2" maxlength="32" required />
      </label>

      <label>
        <span class="eyeless-label">Strefa czasu</span>
        <input class="input" :value="timezone" disabled />
      </label>

      <p v-if="message" class="profile-message">{{ message }}</p>
      <p v-if="errorMessage" class="profile-error">{{ errorMessage }}</p>

      <button class="button-primary" type="submit" :disabled="loading">
        <Save :size="18" aria-hidden="true" />
        {{ loading ? 'Zapisywanie...' : 'Zapisz profil' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.profile-page,
.page-heading,
.profile-form {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p,
.profile-message,
.profile-error {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p,
.profile-message {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

.profile-error {
  color: var(--app-danger);
  font-size: 13px;
  font-weight: 800;
}

.profile-form {
  max-width: 520px;
  padding: 16px;
}
</style>
