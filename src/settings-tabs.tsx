import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type SettingsTab = { key: string; label: string; contains: string; content: ReactNode };
const CHANGED = ".settings-card.dirty, .template-field.changed, .category-row.changed";

function tabFromAddress(tabs: SettingsTab[]) {
  const wanted = new URLSearchParams(window.location.search).get("tab");
  return tabs.some(tab => tab.key === wanted) ? wanted! : tabs[0].key;
}

/**
 * Settings grouped by purpose. Every tab stays loaded behind the scenes, so unsaved typing isn't lost
 * when switching, and a tab shows "Unsaved" while it has changes. The address remembers the open tab.
 */
export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const [active, setActive] = useState(() => tabFromAddress(tabs));
  const [unsaved, setUnsaved] = useState<string[]>([]);
  const panels = useRef<HTMLDivElement>(null);
  function open(key: string) {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const root = panels.current;
    if (!root) return;
    const check = () => {
      const next = [...root.querySelectorAll<HTMLElement>("[data-settings-tab]")].filter(panel => panel.querySelector(CHANGED)).map(panel => panel.dataset.settingsTab!);
      setUnsaved(current => current.join() === next.join() ? current : next);
    };
    const observer = new MutationObserver(check);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    check();
    return () => observer.disconnect();
  }, []);
  const current = tabs.find(tab => tab.key === active) ?? tabs[0];
  return <>
    <nav className="settings-tabs" aria-label="Settings categories">{tabs.map(tab => <button type="button" key={tab.key} className={tab.key === active ? "settings-tab selected" : "settings-tab"} aria-current={tab.key === active ? "page" : undefined} onClick={() => open(tab.key)}>
      <b>{tab.label}{unsaved.includes(tab.key) && <span className="settings-tab-unsaved">Unsaved</span>}</b>
      <small>{tab.contains}</small>
    </button>)}</nav>
    <h2 className="settings-tab-title">{current.label}</h2>
    <div ref={panels}>{tabs.map(tab => <div key={tab.key} data-settings-tab={tab.key} hidden={tab.key !== active}>{tab.content}</div>)}</div>
  </>;
}
