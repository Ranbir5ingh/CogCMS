'use client';

import type { ComparisonConfig } from '@/lib/blog-content/graphics/types';
import { TextField, ColorField, Toggle, RowButton, RemoveButton } from './controls';

export default function ComparisonForm({
  value,
  onChange,
}: {
  value: ComparisonConfig;
  onChange: (c: ComparisonConfig) => void;
}) {
  const patchColumn = (i: number, patch: Partial<ComparisonConfig['columns'][number]>) =>
    onChange({
      ...value,
      columns: value.columns.map((col, idx) =>
        idx === i ? { ...col, ...patch } : col,
      ) as ComparisonConfig['columns'],
    });

  const setPoint = (col: number, p: number, text: string) =>
    patchColumn(col, {
      points: value.columns[col].points.map((pt, idx) => (idx === p ? text : pt)),
    });

  const addPoint = (col: number) =>
    patchColumn(col, { points: [...value.columns[col].points, ''] });

  const removePoint = (col: number, p: number) =>
    patchColumn(col, { points: value.columns[col].points.filter((_, idx) => idx !== p) });

  return (
    <div>
      <Toggle
        label="Animate (reveal on scroll)"
        checked={value.animate}
        onChange={(animate) => onChange({ ...value, animate })}
      />
      <ColorField
        label="Accent color"
        value={value.accentColor}
        onChange={(v) => onChange({ ...value, accentColor: v })}
      />

      <div className="grid grid-cols-2 gap-3">
        {value.columns.map((col, ci) => (
          <div
            key={ci}
            className="p-3 rounded-xl border"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <TextField
              label={`Column ${ci + 1} heading`}
              value={col.heading}
              onChange={(v) => patchColumn(ci, { heading: v })}
              placeholder={ci === 0 ? 'Before' : 'After'}
            />
            <span className="block text-[11px] font-medium text-gray-500 mb-1">Points</span>
            {col.points.map((pt, pi) => (
              <div key={pi} className="flex items-center gap-1.5 mb-1.5">
                <input
                  className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                  value={pt}
                  placeholder={`Point ${pi + 1}`}
                  onChange={(e) => setPoint(ci, pi, e.target.value)}
                />
                <RemoveButton
                  label={`Remove point ${pi + 1}`}
                  onClick={() => removePoint(ci, pi)}
                  disabled={col.points.length <= 1}
                />
              </div>
            ))}
            <RowButton label="+ Add point" onClick={() => addPoint(ci)} />
          </div>
        ))}
      </div>
    </div>
  );
}
