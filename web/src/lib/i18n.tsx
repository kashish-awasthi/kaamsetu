import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Worker-facing screens in English and Hindi. Many frontline workers read
 * Hindi more comfortably, so the toggle is one tap away in the header.
 */
const dict = {
  en: {
    findJobs: 'Find jobs',
    searchPlaceholder: 'Search jobs, e.g. driver, delivery',
    allCities: 'All cities',
    allCategories: 'All jobs',
    anyShift: 'Any shift',
    minSalary: 'Min salary',
    any: 'Any',
    perMonth: '/month',
    openings: 'openings',
    skillsMatch: 'of your skills match',
    applied: 'Applied',
    apply: 'Apply now',
    applying: 'Applying…',
    loginToApply: 'Log in to apply',
    jobClosed: 'This job is closed',
    loadMore: 'Load more jobs',
    noJobs: 'No jobs match your search. Try another city or fewer filters.',
    myApplications: 'My applications',
    noApplications: "You haven't applied to any jobs yet.",
    login: 'Log in',
    logout: 'Log out',
    register: 'Sign up',
    shift_day: 'Day shift',
    shift_night: 'Night shift',
    shift_rotational: 'Rotational',
    shift_flexible: 'Flexible',
    status_applied: 'Applied',
    status_shortlisted: 'Shortlisted',
    status_interview: 'Interview',
    status_hired: 'Hired',
    status_rejected: 'Not selected',
    skillsNeeded: 'Skills needed',
    aboutJob: 'About the job',
    applicants: 'applicants',
    back: 'Back',
  },
  hi: {
    findJobs: 'नौकरी खोजें',
    searchPlaceholder: 'नौकरी खोजें, जैसे ड्राइवर, डिलीवरी',
    allCities: 'सभी शहर',
    allCategories: 'सभी नौकरियाँ',
    anyShift: 'कोई भी शिफ्ट',
    minSalary: 'न्यूनतम वेतन',
    any: 'कोई भी',
    perMonth: '/महीना',
    openings: 'पद',
    skillsMatch: 'आपके कौशल मेल खाते हैं',
    applied: 'आवेदन किया',
    apply: 'अभी आवेदन करें',
    applying: 'आवेदन हो रहा है…',
    loginToApply: 'आवेदन के लिए लॉग इन करें',
    jobClosed: 'यह नौकरी बंद हो गई है',
    loadMore: 'और नौकरियाँ देखें',
    noJobs: 'कोई नौकरी नहीं मिली। दूसरा शहर या कम फ़िल्टर आज़माएँ।',
    myApplications: 'मेरे आवेदन',
    noApplications: 'आपने अभी तक कोई आवेदन नहीं किया है।',
    login: 'लॉग इन',
    logout: 'लॉग आउट',
    register: 'साइन अप',
    shift_day: 'दिन की शिफ्ट',
    shift_night: 'रात की शिफ्ट',
    shift_rotational: 'बदलती शिफ्ट',
    shift_flexible: 'लचीली शिफ्ट',
    status_applied: 'आवेदन किया',
    status_shortlisted: 'शॉर्टलिस्ट',
    status_interview: 'इंटरव्यू',
    status_hired: 'चयनित',
    status_rejected: 'चयन नहीं हुआ',
    skillsNeeded: 'ज़रूरी कौशल',
    aboutJob: 'नौकरी के बारे में',
    applicants: 'आवेदक',
    back: 'वापस',
  },
} as const

export type Lang = keyof typeof dict
export type MessageKey = keyof (typeof dict)['en']

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: MessageKey) => string
}

const I18nContext = createContext<I18n | null>(null)
const LANG_KEY = 'kaamsetu.lang'

function initialLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en'
  } catch {
    return 'en'
  }
}

export function I18nProvider({ children, lang: forced }: { children: ReactNode; lang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(forced ?? initialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    document.documentElement.lang = l
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])
  const value = useMemo<I18n>(() => ({ lang, setLang, t: (key) => dict[lang][key] }), [lang, setLang])
  return <I18nContext value={value}>{children}</I18nContext>
}

export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  return ctx
}
