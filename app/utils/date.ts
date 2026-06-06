export function formatKickoff(utcDate: string, locale = 'pl-PL') {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(utcDate))
}

export function formatShortDate(utcDate: string, locale = 'pl-PL') {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(utcDate))
}
