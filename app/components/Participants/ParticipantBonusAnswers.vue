<script setup lang="ts">
import type { BonusPrediction, BonusQuestion, Player, Team, TournamentStage } from '~/types/domain'
import {
  isBonusAnswerFilled,
  questionSectionLabel,
  resolveBonusQuestion,
  type ResolvedBonusQuestion,
} from '~/utils/bonus'

const props = defineProps<{
  participantName: string
  questions: readonly BonusQuestion[]
  predictions: readonly BonusPrediction[]
  teams: readonly Team[]
  players: readonly Player[]
  stages: readonly TournamentStage[]
  loading: boolean
  errorMessage: string
}>()

const resolvedQuestions = computed<ResolvedBonusQuestion[]>(() =>
  [...props.questions]
    .map((question) => resolveBonusQuestion(question))
    .sort((left, right) => {
      const orderLeft = left.displayOrder ?? Number.MAX_SAFE_INTEGER
      const orderRight = right.displayOrder ?? Number.MAX_SAFE_INTEGER

      return orderLeft - orderRight || left.title.localeCompare(right.title, 'pl')
    }),
)

const predictionByQuestionId = computed(
  () => new Map(props.predictions.map((prediction) => [prediction.questionId, prediction])),
)

const groupedQuestions = computed(() => {
  const groups = new Map<string, ResolvedBonusQuestion[]>()

  for (const question of resolvedQuestions.value) {
    const label = questionSectionLabel(question.section)
    groups.set(label, [...(groups.get(label) ?? []), question])
  }

  return [...groups.entries()].map(([label, questions]) => ({ label, questions }))
})

const answeredCount = computed(() =>
  resolvedQuestions.value.filter((question) =>
    isBonusAnswerFilled(question, predictionByQuestionId.value.get(question.id)?.answerJson),
  ).length,
)
</script>

<template>
  <section class="bonus-answers">
    <div class="answers-heading">
      <div>
        <span class="eyebrow">Odpowiedzi uczestnika</span>
        <h2>{{ props.participantName }}</h2>
      </div>
      <strong>{{ answeredCount }}/{{ resolvedQuestions.length }}</strong>
    </div>

    <p v-if="props.loading" class="state-panel panel">Pobieram odpowiedzi...</p>
    <p v-else-if="props.errorMessage" class="state-panel panel">{{ props.errorMessage }}</p>
    <p v-else-if="!resolvedQuestions.length" class="state-panel panel">
      Odpowiedzi uczestników pojawią się po terminie pytań.
    </p>

    <template v-else>
      <section v-for="group in groupedQuestions" :key="group.label" class="question-section">
        <div class="section-heading">
          <h3>{{ group.label }}</h3>
          <strong>{{ group.questions.length }}</strong>
        </div>

        <div class="question-grid">
          <BonusQuestionCard
            v-for="question in group.questions"
            :key="question.id"
            :question="question"
            :prediction="predictionByQuestionId.get(question.id) ?? null"
            locked
            :answered="isBonusAnswerFilled(question, predictionByQuestionId.get(question.id)?.answerJson)"
          >
            <BonusAnswerField
              v-if="isBonusAnswerFilled(question, predictionByQuestionId.get(question.id)?.answerJson)"
              :model-value="predictionByQuestionId.get(question.id)?.answerJson ?? null"
              :question="question"
              :teams="props.teams"
              :players="props.players"
              :stages="props.stages"
              disabled
            />
            <p v-else class="empty-answer">Brak odpowiedzi</p>
          </BonusQuestionCard>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.bonus-answers,
.question-section,
.question-grid {
  display: grid;
  gap: 16px;
}

.answers-heading,
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
}

.answers-heading > div {
  display: grid;
  gap: 4px;
}

.answers-heading h2,
.section-heading h3,
.empty-answer {
  margin: 0;
}

.answers-heading h2 {
  font-size: 28px;
  line-height: 1;
}

.answers-heading > strong {
  color: var(--app-primary-dark);
  font-size: 14px;
  font-weight: 950;
}

.eyebrow {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.section-heading h3 {
  font-size: 22px;
}

.section-heading strong {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 900;
}

.question-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.state-panel,
.empty-answer {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 800;
}

.state-panel {
  margin: 0;
  padding: 14px;
}

@media (max-width: 920px) {
  .question-grid {
    grid-template-columns: 1fr;
  }
}
</style>
