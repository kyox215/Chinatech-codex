"use client";
import { Globe2 } from "lucide-react";
import { SelectControl } from "@/components/select-control";
import { useLanguage } from "@/components/language-provider";
import { isLocale, languageNames, locales } from "@/lib/i18n/locale";
import styles from "./language-switcher.module.css";
export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  return <label className={`module-select ${styles.switcher}`}><Globe2 size={18} aria-hidden="true" /><span className="visually-hidden">语言 / Lingua / Language</span><SelectControl aria-label="语言 / Lingua / Language" value={locale} onChange={event => { if (isLocale(event.target.value)) setLocale(event.target.value); }}>{locales.map(value => <option value={value} key={value} lang={value}>{languageNames[value]}</option>)}</SelectControl></label>;
}
