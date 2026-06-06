<script setup lang="ts">
import { CalendarClock, CircleHelp, Save, Trophy } from 'lucide-vue-next'
import type { BonusPrediction } from '~/types/domain'
import { formatShortDate } from '~/utils/date'
import {
  defaultAnswerForQuestion,
  filledBonusCount,
  isBonusAnswerFilled,
  isBonusLocked,
  questionSectionLabel,
  resolveBonusGlobalLockAt,
  resolveBonusQuestion,
  type ResolvedBonusQuestion,
} from '~/utils/bonus'

const {
  bonusPredictions,
  bonusQuestions,
  currentUserId,
  deleteBonusPrediction,
  hasLeague,
  isLoading,
  matches,
  players,
  stages,
  teams,
  tournament,
  upsertBonusPrediction,
} = useTyperekData()

const drafts = shallowRef<Record<string, Record<string, unknown> | null>>({})
const saveState = shallowRef<'idle' | 'saving' | 'saved' | 'error'>('idle')
const saveMessage = shallowRef('')

const globalLockAt = computed(() => resolveBonusGlobalLockAt(matches, teams, tournament))

const resolvedQuestions = computed<ResolvedBonusQuestion[]>(() =>
  [...bonusQuestions]
    .map((question) => resolveBonusQuestion(question))
    .sort((left, right) => {
      const orderLeft = left.displayOrder ?? Number.MAX_SAFE_INTEGER
      const orderRight = right.displayOrder ?? Number.MAX_SAFE_INTEGER

      if (orderLeft !== orderRight) {
        return orderLeft - orderRight
      }

      return left.title.localeCompare(right.title, 'pl')
    }),
)

const predictionByQuestionId = computed(() => {
  const map = new Map<string, BonusPrediction>()

  for (const prediction of bonusPredictions.value) {
    map.set(prediction.questionId, prediction)
  }

  return map
})

watch(
  [resolvedQuestions, predictionByQuestionId, teams],
  ([questions, predictionMap, currentTeams]) => {
    const nextDrafts: Record<string, Record<string, unknown> | null> = { ...drafts.value }
    const activeQuestionIds = new Set(questions.map((question) => question.id))

    for (const question of questions) {
      const savedAnswer = predictionMap.get(question.id)?.answerJson ?? null
      nextDrafts[question.id] = savedAnswer ?? nextDrafts[question.id] ?? defaultAnswerForQuestion(question, currentTeams)
    }

    for (const questionId of Object.keys(nextDrafts)) {
      if (!activeQuestionIds.has(questionId)) {
        delete nextDrafts[questionId]
      }
    }

    drafts.value = nextDrafts
  },
  { immediate: true },
)

const groupedQuestions = computed(() => {
  const sections = new Map<string, ResolvedBonusQuestion[]>()

  for (const question of resolvedQuestions.value) {
    const label = questionSectionLabel(question.section)
    const current = sections.get(label) ?? []
    current.push(question)
    sections.set(label, current)
  }

  return [...sections.entries()].map(([label, questions]) => ({ label, questions }))
})

const totalBonusPoints = computed(() => resolvedQuestions.value.reduce((sum, question) => sum + question.points, 0))
const answeredCount = computed(() =>
  filledBonusCount(
    resolvedQuestions.value,
    resolvedQuestions.value.map((question) => ({
      id: question.id,
      questionId: question.id,
      userId: currentUserId.value ?? '',
      answerJson: drafts.value[question.id] ?? null,
      updatedAt: '',
    })),
  ),
)

const dirtyQuestionIds = computed(() =>
  resolvedQuestions.value
    .filter((question) => {
      const savedValue = predictionByQuestionId.value.get(question.id)?.answerJson ?? null
      const draftValue = drafts.value[question.id] ?? null
      return JSON.stringify(savedValue) !== JSON.stringify(draftValue)
    })
    .map((question) => question.id),
)

const locked = computed(() => isBonusLocked(globalLockAt.value))

function updateDraft(questionId: string, answerJson: Record<string, unknown> | null) {
  drafts.value = {
    ...drafts.value,
    [questionId]: answerJson,
  }
}

async function saveAllAnswers() {
  if (locked.value || saveState.value === 'saving') {
    return
  }

  saveState.value = 'saving'
  saveMessage.value = 'Zapisuję odpowiedzi bonusowe...'

  try {
    for (const questionId of dirtyQuestionIds.value) {
      const question = resolvedQuestions.value.find((candidate) => candidate.id === questionId)

      if (!question) {
        continue
      }

      const answerJson = drafts.value[questionId] ?? null
      const filled = isBonusAnswerFilled(question, answerJson)
      const savedPrediction = predictionByQuestionId.value.get(questionId)

      if (!filled) {
        if (savedPrediction) {
          await deleteBonusPrediction(questionId)
        }

        continue
      }

      await upsertBonusPrediction({
        questionId,
        answerJson,
      })
    }

    saveState.value = 'saved'
    saveMessage.value = 'Odpowiedzi bonusowe zapisane.'
  } catch (error) {
    saveState.value = 'error'
    saveMessage.value = error instanceof Error ? error.message : 'Nie udało się zapisać odpowiedzi bonusowych.'
  }
}
</script>

<template>
  <section class="bonus-page">
    <BackLink to="/league" label="Wróć do ligi" />

    <header class="bonus-hero">
      <div class="hero-copy">
        <span class="hero-kicker">MŚ 2026</span>
        <h1>Pytania bonusowe</h1>
        <p>
          Odpowiedzi bonusowe zamykają się w chwili startu mundialu. Zapisujesz cały pakiet jednym kliknięciem, a po deadlinie ekran przechodzi w tryb tylko do odczytu.
        </p>
        <div class="hero-meta">
          <span class="hero-chip">
            <CalendarClock :size="15" aria-hidden="true" />
            Deadline: {{ globalLockAt ? formatShortDate(globalLockAt) : 'brak daty' }}
          </span>
          <span class="hero-chip">
            <Trophy :size="15" aria-hidden="true" />
            {{ totalBonusPoints }} pkt + 120 pkt za grupy
          </span>
          <span class="hero-chip">
            <CircleHelp :size="15" aria-hidden="true" />
            {{ answeredCount }}/{{ resolvedQuestions.length }} odpowiedzi
          </span>
        </div>
      </div>
    </header>

    <p v-if="!hasLeague" class="state-panel panel">Najpierw dołącz do ligi, żeby odpowiadać na pytania bonusowe.</p>
    <p v-else-if="isLoading && !resolvedQuestions.length" class="state-panel panel">Ładuję pytania bonusowe...</p>

    <p v-if="hasLeague && locked" class="locked-banner panel" role="status">
      Typowanie bonusowe zamknięte. Możesz tylko przeglądać zapisane odpowiedzi.
    </p>

    <template v-if="hasLeague && resolvedQuestions.length">
      <section v-for="group in groupedQuestions" :key="group.label" class="question-section" :data-section="group.questions[0]?.section ?? 'quick'">
        <div class="section-heading">
          <div>
            <h2>{{ group.label }}</h2>
          </div>
          <strong>{{ group.questions.length }}</strong>
        </div>

        <div class="question-grid">
          <BonusQuestionCard
            v-for="question in group.questions"
            :key="question.id"
            :question="question"
            :prediction="predictionByQuestionId.get(question.id) ?? null"
            :locked="locked"
            :answered="isBonusAnswerFilled(question, drafts[question.id] ?? null)"
          >
            <BonusAnswerField
              :model-value="drafts[question.id] ?? null"
              :question="question"
              :teams="teams"
              :players="players"
              :stages="stages"
              :disabled="locked"
              @update:model-value="updateDraft(question.id, $event)"
            />
          </BonusQuestionCard>
        </div>
      </section>
    </template>

    <p v-else-if="hasLeague" class="empty-state panel">Brak pytań bonusowych.</p>

    <div v-if="hasLeague" class="save-bar">
      <div class="save-copy">
        <strong>{{ dirtyQuestionIds.length }} zmian do zapisu</strong>
        <span>{{ saveMessage || 'Zapis obejmuje wszystkie odpowiedzi bonusowe naraz.' }}</span>
      </div>
      <button class="button-primary save-button" type="button" :disabled="locked || saveState === 'saving' || !dirtyQuestionIds.length" @click="saveAllAnswers">
        <Save :size="18" aria-hidden="true" />
        {{ saveState === 'saving' ? 'Zapisuję...' : 'Zapisz odpowiedzi' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.bonus-page,
.hero-copy,
.question-section,
.question-grid,
.save-copy {
  display: grid;
  gap: 16px;
}

.bonus-hero {
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(12, 107, 70, 0.95), rgba(20, 33, 27, 0.95));
  color: white;
  padding: 24px;
}

.hero-kicker,
.eyebrow {
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.bonus-hero h1,
.bonus-hero p,
.section-heading h2 {
  margin: 0;
}

.bonus-hero h1 {
  font-size: clamp(34px, 8vw, 54px);
  line-height: 1;
}

.bonus-hero p {
  max-width: 760px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-chip {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  padding: 0 12px;
  font-size: 12px;
  font-weight: 850;
}

.state-panel,
.empty-state,
.locked-banner {
  margin: 0;
  padding: 14px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 800;
}

.locked-banner {
  color: #856111;
  background: #fffaf0;
}

.section-heading,
.save-bar {
  display: flex;
  gap: 12px;
}

.section-heading,
.save-bar {
  align-items: center;
  justify-content: space-between;
}

.section-heading strong {
  font-size: 14px;
  font-weight: 900;
}

.section-heading h2 {
  font-size: 24px;
  line-height: 1;
}

.question-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.question-section[data-section='groups'] .question-grid {
  grid-template-columns: 1fr;
}

.save-bar {
  position: sticky;
  bottom: 12px;
  z-index: 12;
  margin-top: 8px;
  border: 1px solid rgba(189, 209, 195, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  padding: 14px;
}

.save-copy strong,
.save-copy span {
  margin: 0;
}

.save-copy strong {
  font-size: 15px;
  font-weight: 900;
}

.save-copy span {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.save-button {
  flex: 0 0 auto;
  min-width: 220px;
}

@media (max-width: 920px) {
  .question-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .section-heading,
  .save-bar {
    align-items: stretch;
    flex-direction: column;
    bottom: 82px;
  }

  .save-button {
    min-width: 0;
    width: 100%;
  }
}
</style>
