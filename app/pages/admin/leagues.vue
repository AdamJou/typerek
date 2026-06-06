<script setup lang="ts">
import { Copy, Save } from 'lucide-vue-next'

const { league } = useTyperekData()
const leagueName = shallowRef(league.name)
const inviteCode = 'WC26-ADAM'
</script>

<template>
  <section class="admin-page">
    <div class="page-heading">
      <h1>Liga</h1>
      <p>Ligę tworzy tylko administrator. Kod zaproszenia jest przechowywany jako hash w bazie.</p>
    </div>

    <div class="admin-grid">
      <form class="admin-card panel">
        <label>
          <span class="eyeless-label">Nazwa ligi</span>
          <input v-model="leagueName" class="input" />
        </label>
        <button class="button-primary" type="button">
          <Save :size="18" aria-hidden="true" />
          Zapisz nazwę
        </button>
      </form>

      <section class="admin-card panel">
        <label>
          <span class="eyeless-label">Kod dołączenia</span>
          <input class="input" :value="inviteCode" readonly />
        </label>
        <button class="button-secondary" type="button">
          <Copy :size="18" aria-hidden="true" />
          Skopiuj kod
        </button>
      </section>
    </div>
  </section>
</template>

<style scoped>
.admin-page,
.page-heading,
.admin-grid,
.admin-card {
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

.admin-card {
  padding: 16px;
}

@media (min-width: 820px) {
  .admin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
