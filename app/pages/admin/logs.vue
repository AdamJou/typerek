<template>
  <section class="admin-page">
    <div class="page-heading">
      <h1>Logi administratora</h1>
      <p>Każda ręczna korekta ma zapisywać kto, kiedy, co zmienił oraz poprzednią i nową wartość.</p>
    </div>

    <AuditLogTable />
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
</style>
