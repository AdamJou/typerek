<template>
  <main class="auth-layout">
    <section class="auth-card panel">
      <NuxtLink class="auth-brand" to="/league">
        <AppLogo />
      </NuxtLink>
      <slot />
    </section>
  </main>
</template>

<style scoped>
.auth-layout {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 24px;
}

.auth-card {
  width: min(100%, 430px);
  padding: 24px;
}

.auth-brand {
  display: inline-flex;
  margin-bottom: 26px;
}
</style>
