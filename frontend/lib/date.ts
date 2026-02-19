// frontend/lib/date.ts

/**
 * Get the start of today (midnight local time).
 */
export function getStartOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Get a date N days ago from start of today.
 */
export function getDaysAgo(days: number): Date {
  return new Date(getStartOfToday().getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * Get date range boundaries for common filter options.
 * Returns [startDate, endDate] where endDate is exclusive.
 */
export function getDateRangeBounds(
  range: 'today' | 'yesterday' | 'last7' | 'last30'
): [Date, Date | null] {
  const startOfToday = getStartOfToday()

  switch (range) {
    case 'today':
      return [startOfToday, null] // null = no upper bound
    case 'yesterday':
      return [getDaysAgo(1), startOfToday] // yesterday only, excludes today
    case 'last7':
      return [getDaysAgo(7), null]
    case 'last30':
      return [getDaysAgo(30), null]
  }
}

/**
 * Check if a date falls within a range.
 * @param date - Date to check
 * @param start - Start of range (inclusive)
 * @param end - End of range (exclusive), or null for no upper bound
 */
export function isDateInRange(date: Date, start: Date, end: Date | null): boolean {
  if (date < start) return false
  if (end && date >= end) return false
  return true
}
