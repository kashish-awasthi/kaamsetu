const rupees = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** ₹18,000 – ₹24,000, using Indian digit grouping (₹1,20,000). */
export const formatSalary = (min: number, max: number) =>
  min === max ? `₹${rupees.format(min)}` : `₹${rupees.format(min)} – ₹${rupees.format(max)}`

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === 'minute') {
      const value = Math.round(diff / ms)
      return unit === 'day' && Math.abs(value) > 30
        ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : rtf.format(value, unit)
    }
  }
  return ''
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
