<script setup lang="ts">
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import type { BonusEntityOption } from '~/utils/bonus'
import { normalizeBonusText } from '~/utils/bonus'

const props = defineProps<{
  modelValue: string | null
  options: readonly BonusEntityOption[]
  placeholder: string
  disabled?: boolean
  emptyLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const rootRef = useTemplateRef<HTMLElement>('root')
const searchRef = useTemplateRef<HTMLInputElement>('search')
const isOpen = shallowRef(false)
const searchQuery = shallowRef('')
const activeIndex = shallowRef(0)

const selectedOption = computed(() => props.options.find((option) => option.id === props.modelValue) ?? null)
const visibleOptions = computed(() => {
  const query = normalizeBonusText(searchQuery.value)

  if (!query) {
    return props.options
  }

  return props.options.filter((option) =>
    [option.label, option.meta, ...option.keywords].some((value) => normalizeBonusText(value).includes(query)),
  )
})

watch(isOpen, async (open) => {
  if (!open) {
    searchQuery.value = ''
    activeIndex.value = 0
    return
  }

  await nextTick()
  searchRef.value?.focus()
})

watch(
  visibleOptions,
  (options) => {
    if (!options.length) {
      activeIndex.value = 0
      return
    }

    activeIndex.value = Math.min(activeIndex.value, options.length - 1)
  },
  { immediate: true },
)

function openPicker() {
  if (props.disabled) {
    return
  }

  isOpen.value = true
}

function closePicker() {
  isOpen.value = false
}

function togglePicker() {
  if (isOpen.value) {
    closePicker()
    return
  }

  openPicker()
}

function selectOption(optionId: string) {
  emit('update:modelValue', optionId)
  closePicker()
}

function clearSelection() {
  emit('update:modelValue', null)
  closePicker()
}

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    openPicker()
    return
  }

  if (!isOpen.value) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closePicker()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, Math.max(visibleOptions.value.length - 1, 0))
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const option = visibleOptions.value[activeIndex.value]
    if (option) {
      selectOption(option.id)
    }
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!rootRef.value) {
    return
  }

  if (event.target instanceof Node && !rootRef.value.contains(event.target)) {
    closePicker()
  }
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('mousedown', onDocumentClick)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('mousedown', onDocumentClick)
  }
})
</script>

<template>
  <div ref="root" class="picker" :data-open="isOpen" :data-disabled="disabled" @keydown="onKeydown">
    <button class="picker-trigger" type="button" :disabled="disabled" @click="togglePicker">
      <span class="picker-copy">
        <span class="picker-value">{{ selectedOption?.label ?? placeholder }}</span>
        <span class="picker-meta">{{ selectedOption?.meta ?? emptyLabel ?? 'Wyszukiwanie po nazwie i danych pomocniczych' }}</span>
      </span>
      <ChevronDown :size="18" aria-hidden="true" />
    </button>

    <div v-if="isOpen" class="picker-dropdown panel">
      <label class="picker-search">
        <Search :size="16" aria-hidden="true" />
        <input ref="search" v-model="searchQuery" type="search" :placeholder="placeholder" />
      </label>

      <button v-if="modelValue" class="picker-clear" type="button" @click="clearSelection">
        <X :size="14" aria-hidden="true" />
        Wyczyść wybór
      </button>

      <div v-if="visibleOptions.length" class="picker-options">
        <button
          v-for="(option, index) in visibleOptions"
          :key="option.id"
          class="picker-option"
          type="button"
          :data-active="index === activeIndex"
          :data-selected="option.id === modelValue"
          @click="selectOption(option.id)"
        >
          <span class="picker-option-copy">
            <span class="picker-option-label">{{ option.label }}</span>
            <span v-if="option.meta" class="picker-option-meta">{{ option.meta }}</span>
          </span>
          <Check v-if="option.id === modelValue" :size="16" aria-hidden="true" />
        </button>
      </div>

      <p v-else class="picker-empty">{{ emptyLabel ?? 'Brak wyników dla tego wyszukiwania.' }}</p>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
  isolation: isolate;
}

.picker[data-open='true'] {
  z-index: 2;
}

.picker-trigger,
.picker-option,
.picker-clear {
  width: 100%;
}

.picker-trigger {
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #f7faf7);
  color: var(--app-ink);
  padding: 10px 12px;
  text-align: left;
}

.picker-trigger:disabled {
  opacity: 0.6;
}

.picker-copy,
.picker-option-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.picker-value,
.picker-option-label {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-meta,
.picker-option-meta,
.picker-empty {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.picker-dropdown {
  position: absolute;
  z-index: 2;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  display: grid;
  gap: 10px;
  overflow: hidden;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 44px rgba(16, 31, 23, 0.16);
  backdrop-filter: none;
  padding: 12px;
}

.picker-search {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
  padding: 0 12px;
}

.picker-search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--app-ink);
  font: inherit;
  font-size: 14px;
  font-weight: 800;
}

.picker-clear {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #f6faf7;
  color: var(--app-muted);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
}

.picker-options {
  display: grid;
  max-height: 280px;
  overflow: auto;
  background: #ffffff;
}

.picker-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  padding: 10px;
  text-align: left;
}

.picker-option[data-active='true'],
.picker-option:hover {
  background: #f4f8f5;
}

.picker-option[data-selected='true'] {
  background: rgba(19, 125, 78, 0.08);
  color: var(--app-primary-dark);
}
</style>
