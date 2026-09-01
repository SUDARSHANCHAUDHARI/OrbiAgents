import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src", "renderer", "src");
const files = {
  "NotoSans-VF.ttf": ["a7e136b1610b46c15e4e8a50cf36211bd3e18ebd33e2e0692294cf28b6c9099b", 2_000_000],
  "NotoSansArabic-VF.ttf": ["c16ae8cbd93e8f2d15b5462dcb717dba11ff961efbe4610a78f566b77be820f4", 400_000],
  "NotoSansSC-VF.ttf": ["d68bafcb48a2707749396aa12bbbd833cb70401f3a9a689fd2902c7e0d295964", 18_000_000],
};
for (const [name, [expectedHash, maxBytes]] of Object.entries(files)) {
  const file = path.join(root, "assets", "fonts", name); const bytes = await readFile(file); const size = (await stat(file)).size;
  if (size > maxBytes) throw new Error(`${name} exceeds its reviewed size bound`);
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error(`${name} does not match the pinned upstream asset`);
}
for (const license of ["OFL-NotoSans.txt", "OFL-NotoSansArabic.txt", "OFL-NotoSansSC.txt"]) {
  const source = await readFile(path.join(root, "assets", "fonts", license), "utf8"); if (!source.includes("SIL OPEN FONT LICENSE Version 1.1")) throw new Error(`${license} is not the expected OFL license`);
}
const [tokens, i18n, chinese, arabic] = await Promise.all([readFile(path.join(root, "styles", "tokens.css"), "utf8"), readFile(path.join(root, "i18n.tsx"), "utf8"), readFile(path.join(root, "locales", "zh-CN.ts"), "utf8"), readFile(path.join(root, "locales", "ar.ts"), "utf8")]);
for (const marker of ["Orbi Noto Sans", "Orbi Noto Sans Arabic", "Orbi Noto Sans SC", ':root:lang(zh-CN)', ':root:lang(ar)']) if (!tokens.includes(marker)) throw new Error(`Missing localized font marker ${marker}`);
if (!i18n.includes('locale === "ar" ? "rtl" : "ltr"')) throw new Error("Arabic RTL direction is not explicit");
const englishKeys = keys(i18n, "const englishMessages = {", "} as const;"); const chineseKeys = keys(chinese, "const messages = {", "} satisfies MessageCatalog;"); const arabicKeys = keys(arabic, "const messages = {", "} satisfies MessageCatalog;");
if (englishKeys.length !== chineseKeys.length || englishKeys.some((key) => !chineseKeys.includes(key))) throw new Error("Chinese catalog keys do not match English");
if (englishKeys.length !== arabicKeys.length || englishKeys.some((key) => !arabicKeys.includes(key))) throw new Error("Arabic catalog keys do not match English");
console.log(`Localization checks passed: ${englishKeys.length} messages, 3 pinned OFL font families, explicit Arabic RTL`);

function keys(source, start, end) { const startAt = source.indexOf(start); const endAt = source.indexOf(end, startAt); if (startAt < 0 || endAt < 0) throw new Error("Message catalog structure is invalid"); const body = source.slice(startAt + start.length, endAt); return [...body.matchAll(/(?:^|,\s+)([A-Za-z][A-Za-z0-9]*):/g)].map((match) => match[1]); }
