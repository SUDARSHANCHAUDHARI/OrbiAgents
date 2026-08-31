import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type Locale = "en" | "zh-CN" | "ar";
const messages = {
  en: {
    locale: "Interface language", help: "OrbiAgents uses only the language selected here and never reads the operating-system locale.", subtitle: "Local command deck · authenticated runtime telemetry", active: "active", hire: "Hire agent",
    commandCenter: "Command Center", operate: "Operate", coordinate: "Coordinate", observe: "Observe", system: "System",
    floor: "Floor", terminals: "Terminals", files: "Files", repository: "Repository", tasks: "Tasks", messages: "Messages", approvals: "Approvals", memory: "Memory", skills: "Skills", activity: "Activity", costs: "Costs", recovery: "Recovery", workspaces: "Workspaces", settings: "Settings", updates: "Updates", setup: "Setup",
  },
  "zh-CN": {
    locale: "界面语言", help: "OrbiAgents 仅使用此处选择的语言，不读取操作系统语言。", subtitle: "本地智能体指挥台 · 已验证的运行遥测", active: "运行中", hire: "聘用智能体",
    commandCenter: "指挥中心", operate: "操作", coordinate: "协作", observe: "监控", system: "系统",
    floor: "总览", terminals: "终端", files: "文件", repository: "代码仓库", tasks: "任务", messages: "消息", approvals: "审批", memory: "记忆", skills: "技能", activity: "活动", costs: "成本", recovery: "恢复", workspaces: "工作区", settings: "设置", updates: "更新", setup: "配置",
  },
  ar: {
    locale: "لغة الواجهة", help: "يستخدم OrbiAgents اللغة المحددة هنا فقط ولا يقرأ لغة نظام التشغيل.", subtitle: "مركز قيادة محلي · قياس تشغيل موثّق", active: "نشط", hire: "توظيف وكيل",
    commandCenter: "مركز القيادة", operate: "تشغيل", coordinate: "تنسيق", observe: "مراقبة", system: "النظام",
    floor: "الساحة", terminals: "الطرفيات", files: "الملفات", repository: "المستودع", tasks: "المهام", messages: "الرسائل", approvals: "الموافقات", memory: "الذاكرة", skills: "المهارات", activity: "النشاط", costs: "التكاليف", recovery: "الاستعادة", workspaces: "مساحات العمل", settings: "الإعدادات", updates: "التحديثات", setup: "التهيئة",
  },
} as const;
export type MessageKey = keyof typeof messages.en;
const Context = createContext<{ locale: Locale; setLocale(locale: Locale): void; t(key: MessageKey): string }>({ locale: "en", setLocale: () => undefined, t: (key) => messages.en[key] });
export function I18nProvider({ children }: { children: ReactNode }) { const [locale, setLocale] = useState<Locale>(() => { try { const saved = localStorage.getItem("orbiagents.locale"); return saved === "zh-CN" || saved === "ar" ? saved : "en"; } catch { return "en"; } }); useEffect(() => { document.documentElement.lang = locale; document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"; try { localStorage.setItem("orbiagents.locale", locale); } catch { /* optional */ } }, [locale]); const value = useMemo(() => ({ locale, setLocale, t: (key: MessageKey) => messages[locale][key] }), [locale]); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useI18n() { return useContext(Context); }
