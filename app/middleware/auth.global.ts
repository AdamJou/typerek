export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.auth === false) {
    return
  }

  const { init, isAdmin, isAuthenticated, isConfigured } = useAuth()
  await init()

  if (isConfigured.value && !isAuthenticated.value) {
    return navigateTo('/auth/login')
  }

  if (to.path.startsWith('/admin') && !isAdmin.value) {
    return navigateTo('/league')
  }
})
