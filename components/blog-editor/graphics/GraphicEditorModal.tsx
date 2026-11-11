'use client';

import { useMemo, useState } from 'react';
import {
  graphicConfigSchema,
  type GraphicConfig,
  type GraphicType,
} from '@/lib/blog-content/graphics/types';
import { GRAPHIC_DEFAULTS } from '@/lib/blog-content/graphics/defaults';
import StatCardsForm from './StatCardsForm';
import CalloutForm from './CalloutForm';
import ComparisonForm from './ComparisonForm';

const TYPES: { type: GraphicType; label: string; desc: string }[] = [
  { type: 'stat-cards', label: 'Stat cards', desc: 'A row of big-number metric cards' },
  { type: 'callout', label: 'Callout / quote', desc: 'A highlighted statement or quote' },
  { type: 'comparison', label: 'Comparison', desc: 'Two side-by-side columns' },
];

/* Insert/edit a graphic. With `initial` it opens straight into that graphic's form;
   without one it shows the type picker first. Validates with Zod before saving. */
function firstBlankField(config: GraphicConfig): string | null {
  if (config.type === 'callout') {
    return config.text.trim() ? null : 'Add the callout text before saving.';
  }
  if (config.type === 'stat-cards') {
    return config.cards.every((card) => card.label.trim())
      ? null
      : 'Give every stat card a label before saving.';
  }
  return config.columns.every((column) => column.heading.trim())
    ? null
    : 'Give both columns a heading before saving.';
}

export default function GraphicEditorModal({
  initial,
  onSave,
  onRemove,
  onClose,
}: {
  initial: GraphicConfig | null;
  onSave: (config: GraphicConfig) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<GraphicConfig | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const editing = initial !== null;
  const initialSnapshot = useMemo(() => JSON.stringify(initial), [initial]);
  const isDirty = !editing || JSON.stringify(config) !== initialSnapshot;

  // Editing any field clears the message it triggered.
  const updateConfig = (next: GraphicConfig) => {
    setError(null);
    setConfig(next);
  };

  const save = () => {
    if (!config) return;
    const blank = firstBlankField(config);
    if (blank) {
      setError(blank);
      return;
    }
    const result = graphicConfigSchema.safeParse(config);
    if (!result.success) {
      setError('Please fill in all required fields.');
      return;
    }
    onSave(result.data);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
        style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[#1a1a1a]">
            {initial ? 'Edit graphic' : config ? 'New graphic' : 'Insert graphic'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {!config ? (
          <div className="flex flex-col gap-2">
            {TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => setConfig(GRAPHIC_DEFAULTS[t.type]())}
                className="text-left p-4 rounded-xl border hover:border-[#FF751F] hover:bg-orange-50/40 transition-colors"
                style={{ borderColor: 'rgba(0,0,0,0.1)' }}
              >
                <div className="text-sm font-medium text-[#1a1a1a]">{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>
        ) : (
          <>
            {config.type === 'stat-cards' && (
              <StatCardsForm value={config} onChange={updateConfig} />
            )}
            {config.type === 'callout' && <CalloutForm value={config} onChange={updateConfig} />}
            {config.type === 'comparison' && (
              <ComparisonForm value={config} onChange={updateConfig} />
            )}
            {error && (
              <p role="alert" className="text-xs text-red-600 mt-2">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-2 mt-5">
              {editing && onRemove ? (
                <button
                  type="button"
                  onClick={onRemove}
                  className="px-4 py-2 text-[13px] text-red-600 border border-red-200 rounded-full hover:bg-red-50"
                >
                  Remove graphic
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-[13px] text-gray-600 border rounded-full hover:bg-gray-50"
                  style={{ borderColor: 'rgba(0,0,0,0.12)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!isDirty}
                  title={isDirty ? undefined : 'Change a value to enable saving'}
                  className="px-5 py-2 text-[13px] text-white rounded-full transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: '#FF751F' }}
                >
                  Save
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
