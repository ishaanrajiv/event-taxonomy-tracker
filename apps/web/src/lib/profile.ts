export const getActorName = (): string => localStorage.getItem('tracker.profile.displayName')?.trim() || 'Local Analyst'

export const setActorName = (value: string): void => {
  localStorage.setItem('tracker.profile.displayName', value.trim() || 'Local Analyst')
}
