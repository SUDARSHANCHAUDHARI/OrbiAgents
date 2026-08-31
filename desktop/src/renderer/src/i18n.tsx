import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type Locale = "en" | "zh-CN" | "ar";
const messages = {
  en: { locale: "Interface language", help: "OrbiAgents uses only the language selected here and never reads the operating-system locale.", subtitle: "Local command deck · authenticated runtime telemetry", active: "active", hire: "Hire agent" },
  "zh-CN": { locale: "界面语言", help: "OrbiAgents 仅使用此处选择的语言，不读取操作系统语言。", subtitle: "本地智能体指挥台 · 已验证的运行遥测", active: "运行中", hire: "聘用智能体" },
  ar: { locale: "لغة الواجهة", help: "يستخدم OrbiAgents اللغة المحددة هنا فقط ولا يقرأ لغة نظام التشغيل.", subtitle: "مركز قيادة محلي · قياس تشغيل موثّق", active: "نشط", hire: "توظيف وكيل" },
} as const;
type Key = keyof typeof messages.en;
const Context = createContext<{ locale: Locale; setLocale(locale: Locale): void; t(key: Key): string }>({ locale: "en", setLocale: () => undefined, t: (key) => messages.en[key] });
export function I18nProvider({ children }: { children: ReactNode }) { const [locale, setLocale] = useState<Locale>(() => { try { const saved = localStorage.getItem("orbiagents.locale"); return saved === "zh-CN" || saved === "ar" ? saved : "en"; } catch { return "en"; } }); useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"; try { localStorage.setItem("orbiagents.locale", locale); } catch { /* optional */ } }, [locale]); const value = useMemo(() => ({ locale, setLocale, t: (key: Key) => messages[locale][key] }), [locale]); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useI18n() { return useContext(Context); }
