"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { translateText } from "@/lib/client/translations";

type Language = "en" | "id";
const STORAGE = "quickdrop:language";
let memoryLanguage: Language | null = null;
function getLanguage(): Language {
  if (memoryLanguage) return memoryLanguage;
  try {
    return localStorage.getItem(STORAGE) === "id" ? "id" : "en";
  } catch {
    return "en";
  }
}
function subscribe(callback: () => void) {
  const storageChanged = () => {
    memoryLanguage = null;
    callback();
  };
  window.addEventListener("storage", storageChanged);
  window.addEventListener("quickdrop:language", callback);
  return () => {
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener("quickdrop:language", callback);
  };
}
const serverLanguage = (): Language => "en";
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, getLanguage, serverLanguage);
  const t = useCallback(
    (text: string) => translateText(text, language),
    [language],
  );
  function setLanguage(next: Language) {
    memoryLanguage = next;
    try {
      localStorage.setItem(STORAGE, next);
    } catch {}
    window.dispatchEvent(new Event("quickdrop:language"));
  }
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is required");
  return context;
}

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="language-control">
      <span lang="en" className={language === "en" ? "selected-language" : ""}>
        EN
      </span>
      <button
        type="button"
        className="language-switch"
        role="switch"
        aria-label="Bahasa Indonesia"
        aria-checked={language === "id"}
        lang="id"
        onClick={() => setLanguage(language === "en" ? "id" : "en")}
      >
        <span className="language-switch-thumb" />
      </button>
      <span lang="id" className={language === "id" ? "selected-language" : ""}>
        ID
      </span>
    </div>
  );
}
