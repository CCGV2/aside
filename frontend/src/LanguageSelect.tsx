import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { setLocale, useLocale, type Locale } from "./i18n";

function FlagZh() {
  return (
    <svg className="language-select-flag" viewBox="0 0 15 10" aria-hidden="true">
      <rect width="15" height="10" fill="#de2910" />
      <polygon
        points="2.5,1 2.84,2.04 3.93,2.04 3.05,2.68 3.38,3.71 2.5,3.07 1.62,3.71 1.96,2.68 1.07,2.04 2.16,2.04"
        fill="#ffde00"
      />
      <circle cx="5" cy="1" r="0.5" fill="#ffde00" />
      <circle cx="6" cy="2" r="0.5" fill="#ffde00" />
      <circle cx="6" cy="3.5" r="0.5" fill="#ffde00" />
      <circle cx="5" cy="4.5" r="0.5" fill="#ffde00" />
    </svg>
  );
}

function FlagEn() {
  return (
    <svg className="language-select-flag" viewBox="0 0 15 10" aria-hidden="true">
      <rect width="15" height="10" fill="#ffffff" />
      {[0, 2.86, 5.72, 8.58].map((y) => (
        <rect key={y} y={y} width="15" height="1.43" fill="#b31942" />
      ))}
      <rect width="6" height="5.72" fill="#0a3161" />
      {[1.2, 2.86, 4.52].map((cy) =>
        [1.5, 3, 4.5].map((cx) => (
          <circle key={`${cx},${cy}`} cx={cx} cy={cy} r="0.5" fill="#ffffff" />
        )),
      )}
    </svg>
  );
}

const languages = [
  { value: "zh", label: "中文", Flag: FlagZh },
  { value: "en", label: "English", Flag: FlagEn },
] as const;

export function LanguageSelect() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const current =
    languages.find((language) => language.value === locale) ?? languages[0];
  const selectedIndex = languages.findIndex(
    (language) => language.value === locale,
  );

  useEffect(() => {
    if (!open) return;
    optionRefs.current[selectedIndex]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open, selectedIndex]);

  const select = (value: Locale) => {
    setLocale(value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent) => {
    const index = optionRefs.current.indexOf(
      document.activeElement as HTMLLIElement,
    );
    if (event.key === "ArrowDown") {
      event.preventDefault();
      optionRefs.current[(index + 1) % languages.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      optionRefs.current[
        (index - 1 + languages.length) % languages.length
      ]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={`language-select${open ? " open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="language-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={locale === "zh" ? "界面语言" : "Interface language"}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (
            !open &&
            (event.key === "ArrowDown" || event.key === "ArrowUp")
          ) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <current.Flag />
        <span>{current.label}</span>
        <svg
          className="language-select-caret"
          viewBox="0 0 10 6"
          aria-hidden="true"
        >
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <ul
          className="language-select-menu"
          role="listbox"
          aria-label={locale === "zh" ? "界面语言" : "Interface language"}
          onKeyDown={onMenuKeyDown}
        >
          {languages.map(({ value, label, Flag }, index) => (
            <li
              key={value}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              role="option"
              aria-selected={value === locale}
              tabIndex={-1}
              className="language-select-option"
              onClick={() => select(value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  select(value);
                }
              }}
            >
              <Flag />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
