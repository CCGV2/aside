import { useLocale, setLocale } from "./i18n";
export function LanguageSelect() {
  const locale = useLocale();
  return (
    <select
      className="language-select"
      aria-label={locale === "zh" ? "界面语言" : "Interface language"}
      value={locale}
      onChange={(event) => setLocale(event.target.value as "zh" | "en")}
    >
      <option value="zh">中文</option>
      <option value="en">English</option>
    </select>
  );
}
