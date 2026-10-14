"use client";

import { useMemo } from "react";

export type PersonalityValues = {
  sarcasm: number;
  roughness: number;
  directness: number;
  warmth: number;
  push: number;
};

export type PersonalityPreset = keyof typeof PRESETS;

export const PRESETS = {
  Default: { sarcasm: 10, roughness: 10, directness: 80, warmth: 70, push: 30 },
  Tars: { sarcasm: 85, roughness: 50, directness: 90, warmth: 20, push: 60 },
  Servant: { sarcasm: 0, roughness: 0, directness: 30, warmth: 90, push: 10 },
} satisfies Record<string, PersonalityValues>;

const ITEMS: Array<{
  key: keyof PersonalityValues;
  label: string;
  left: string;
  right: string;
}> = [
  { key: "sarcasm", label: "Sarcasm", left: "Earnest", right: "Dry wit" },
  { key: "roughness", label: "Roughness", left: "Gentle", right: "Abrasive" },
  { key: "directness", label: "Directness", left: "Detailed", right: "Concise" },
  { key: "warmth", label: "Warmth", left: "Detached", right: "Friendly" },
  { key: "push", label: "Push", left: "Passive", right: "Proactive" },
];

function SliderIcon({ index }: { index: number }) {
  const glyphs = ["◇", "✦", "⊙", "♡", "↗"];
  return <span aria-hidden="true" className={`apex-personality-glyph glyph-${index}`}>{glyphs[index]}</span>;
}

export default function PersonalityPanel({
  values,
  preset,
  onChange,
  onPreset,
}: {
  values: PersonalityValues;
  preset: PersonalityPreset;
  onChange: (key: keyof PersonalityValues, value: number) => void;
  onPreset: (preset: PersonalityPreset) => void;
}) {
  const activePreset = useMemo(() => {
    const candidate = PRESETS[preset];
    return candidate && Object.keys(candidate).every((key) => candidate[key as keyof PersonalityValues] === values[key as keyof PersonalityValues]);
  }, [preset, values]);

  return (
    <aside className="apex-personality-panel" aria-label="APEX Personality Equalizer">
      <div className="apex-panel-heading">
        <div>
          <div className="apex-panel-kicker">BEHAVIOR MATRIX</div>
          <div className="apex-panel-title">PERSONALITY EQUALIZER</div>
        </div>
        <span className="apex-panel-live">LIVE</span>
      </div>

      <label className="apex-preset-row">
        <span>PRESET</span>
        <select value={preset} onChange={(event) => onPreset(event.target.value as PersonalityPreset)} aria-label="Personality preset">
          {Object.keys(PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>

      <div className="apex-equalizer-list">
        {ITEMS.map((item, index) => (
          <label key={item.key} className="apex-equalizer-item">
            <div className="apex-equalizer-label-row">
              <span className="apex-equalizer-name"><SliderIcon index={index} />{item.label}</span>
              <span className="apex-equalizer-value">{values[item.key]}</span>
            </div>
            <div className="apex-equalizer-scale"><span>{item.left}</span><span>{item.right}</span></div>
            <input
              type="range"
              min="0"
              max="100"
              value={values[item.key]}
              onChange={(event) => onChange(item.key, Number(event.target.value))}
              aria-label={`${item.label}: ${item.left} to ${item.right}`}
            />
          </label>
        ))}
      </div>

      <div className={`apex-personality-note ${activePreset ? "" : "custom"}`}>
        {activePreset ? `${preset.toUpperCase()} PROFILE ACTIVE` : "CUSTOM PROFILE ACTIVE"}
      </div>
    </aside>
  );
}
