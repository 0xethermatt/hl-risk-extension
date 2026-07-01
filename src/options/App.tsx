import { useEffect, useState } from "react";
import { getRiskSettings, setRiskSettings } from "../lib/settingsStorage";
import { DEFAULT_RISK_SETTINGS, type RiskSettings } from "../types/settings";

export function App() {
  const [settings, setSettings] = useState<RiskSettings>(DEFAULT_RISK_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getRiskSettings().then(setSettings);
  }, []);

  const handleSave = () => {
    void setRiskSettings(settings).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-4 bg-slate-950 p-6 text-slate-100">
      <h1 className="text-xl font-semibold">Risk Manager Settings</h1>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-300">Default Risk %</span>
        <input
          type="number"
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          value={settings.defaultRiskPercent}
          onChange={(event) =>
            setSettings({ ...settings, defaultRiskPercent: Number(event.target.value) })
          }
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-300">Max Risk %</span>
        <input
          type="number"
          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
          value={settings.maxRiskPercent}
          onChange={(event) =>
            setSettings({ ...settings, maxRiskPercent: Number(event.target.value) })
          }
        />
      </label>

      <button
        type="button"
        onClick={handleSave}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
      >
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
