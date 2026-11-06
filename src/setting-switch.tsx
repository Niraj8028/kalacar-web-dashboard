/** A clear on/off switch for a setting, with its label and current state beside it. */
export function SettingSwitch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} className={`setting-switch${checked ? " on" : ""}`} onClick={() => onChange(!checked)}>
    <span className="setting-switch-text"><b>{label}</b><small>{hint}</small></span>
    <span className="setting-switch-state">{checked ? "On" : "Off"}</span>
    <span className="setting-switch-track" aria-hidden="true"><i /></span>
  </button>;
}
