import { storeToRefs } from 'pinia'
import { clearTyperekData } from '~/composables/useTyperekData'

export function useAuth() {
  const authStore = useAuthStore()
  const {
    displayName,
    displayEmail,
    errorMessage,
    initialized,
    isAdmin,
    isAuthenticated,
    isConfigured,
    loading,
    profileDisplayName,
    session,
    user,
  } = storeToRefs(authStore)

  async function logout() {
    await authStore.logout()
    clearTyperekData()
    await navigateTo('/auth/login')
  }

  return {
    displayName,
    displayEmail,
    errorMessage,
    initialized,
    isAdmin,
    isAuthenticated,
    isConfigured,
    loading,
    profileDisplayName,
    session,
    user,
    init: authStore.init,
    login: authStore.login,
    logout,
    register: authStore.register,
    updateProfile: authStore.updateProfile,
  }
}
