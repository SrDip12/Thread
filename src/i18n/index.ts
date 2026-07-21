// Configuración i18n (i18next + react-i18next).
// Idioma por defecto español; inglés como alternativa. La app se construyó en
// español, así que el fallback es 'es' (una clave sin traducir muestra el texto es).
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { es } from './locales/es.ts'
import { en } from './locales/en.ts'

export const IDIOMAS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
] as const

export type Idioma = (typeof IDIOMAS)[number]['code']

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    interpolation: { escapeValue: false }, // React ya escapa
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'idioma',
      caches: ['localStorage'],
    },
  })

// Refleja el idioma activo en <html lang> (accesibilidad / SEO).
const aplicarLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng.startsWith('en') ? 'en' : 'es'
}
aplicarLang(i18n.language ?? 'es')
i18n.on('languageChanged', aplicarLang)

export default i18n
