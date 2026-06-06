<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'

interface Props {
  label: string
  autocomplete: 'current-password' | 'new-password'
  minlength?: number
}

defineProps<Props>()

const model = defineModel<string>({ required: true })
const isVisible = shallowRef(false)
</script>

<template>
  <label>
    <span class="eyeless-label">{{ label }}</span>

    <span class="password-field">
      <input
        v-model="model"
        class="input password-input"
        :type="isVisible ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :minlength="minlength"
        required
      />

      <button
        class="password-toggle"
        type="button"
        :aria-label="isVisible ? 'Ukryj hasło' : 'Pokaż hasło'"
        :aria-pressed="isVisible"
        @click="isVisible = !isVisible"
      >
        <EyeOff v-if="isVisible" :size="19" aria-hidden="true" />
        <Eye v-else :size="19" aria-hidden="true" />
      </button>
    </span>
  </label>
</template>

<style scoped>
.password-field {
  position: relative;
  display: block;
}

.password-input {
  padding-right: 46px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 10px;
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-muted);
  cursor: pointer;
  transform: translateY(-50%);
}

.password-toggle:hover,
.password-toggle:focus-visible {
  background: var(--app-surface-strong);
  color: var(--app-primary);
}
</style>
