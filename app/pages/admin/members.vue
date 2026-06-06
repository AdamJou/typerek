<script setup lang="ts">
import { UserMinus } from 'lucide-vue-next'

const { members } = useTyperekData()
</script>

<template>
  <section class="admin-page">
    <div class="page-heading">
      <h1>Uczestnicy</h1>
      <p>Usunięcie uczestnika powinno zapisywać wpis w `admin_audit_logs`.</p>
    </div>

    <div class="members-list panel">
      <article v-for="member in members" :key="member.id" class="member-row">
        <div>
          <strong>{{ member.displayName }}</strong>
          <span>{{ member.status }}</span>
        </div>
        <button class="button-ghost" type="button">
          <UserMinus :size="18" aria-hidden="true" />
          Usuń
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.admin-page,
.page-heading {
  display: grid;
  gap: 16px;
}

.page-heading h1,
.page-heading p {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

.members-list {
  display: grid;
}

.member-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--app-line);
  padding: 14px;
}

.member-row:last-child {
  border-bottom: 0;
}

.member-row div {
  display: grid;
  gap: 4px;
}

.member-row strong {
  font-size: 15px;
}

.member-row span {
  color: var(--app-muted);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}
</style>
