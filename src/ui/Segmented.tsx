import type { Sensitivity } from '../storage';

export const SENSITIVITY_LABEL: Record<Sensitivity, string> = {
  easygoing: 'Easygoing',
  standard: 'Standard',
  cautious: 'Cautious',
};

export const SENSITIVITY_HINT: Record<Sensitivity, string> = {
  easygoing: 'Veils only comments that are almost certainly spoilers.',
  standard: 'Veils comments that are likely spoilers.',
  cautious: 'Veils anything that might be a spoiler.',
};

const ORDER: Sensitivity[] = ['easygoing', 'standard', 'cautious'];

export function SensitivitySegmented({ value, onChange }: { value: Sensitivity; onChange: (v: Sensitivity) => void }) {
  return (
    <div className="pv-segmented" role="group" aria-label="Sensitivity">
      {ORDER.map((s) => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(s)}>
          {SENSITIVITY_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
