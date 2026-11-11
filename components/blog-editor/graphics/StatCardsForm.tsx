'use client';

import type { StatCardsConfig } from '@/lib/blog-content/graphics/types';
import { TextField, NumberField, ColorField, Toggle, RowButton, RemoveButton } from './controls';

export default function StatCardsForm({
  value,
  onChange,
}: {
  value: StatCardsConfig;
  onChange: (c: StatCardsConfig) => void;
}) {
  const patchCard = (i: number, patch: Partial<StatCardsConfig['cards'][number]>) =>
    onChange({
      ...value,
      cards: value.cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    });

  const addCard = () => {
    if (value.cards.length >= 4) return;
    onChange({
      ...value,
      cards: [...value.cards, { number: Number.NaN, label: '', barColor: '#FF751F', caption: '' }],
    });
  };

  const removeCard = (i: number) => {
    if (value.cards.length <= 2) return;
    onChange({ ...value, cards: value.cards.filter((_, idx) => idx !== i) });
  };

  return (
    <div>
      <Toggle
        label="Animate (count-up + reveal on scroll)"
        checked={value.animate}
        onChange={(animate) => onChange({ ...value, animate })}
      />

      {value.cards.map((card, i) => (
        <div
          key={i}
          className="mb-4 p-3 rounded-xl border"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-500">Card {i + 1}</span>
            <RemoveButton
              label={`Remove card ${i + 1}`}
              onClick={() => removeCard(i)}
              disabled={value.cards.length <= 2}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <TextField
              label="Prefix"
              value={card.prefix ?? ''}
              onChange={(v) => patchCard(i, { prefix: v })}
              placeholder="$"
            />
            <NumberField
              label="Number"
              value={card.number}
              onChange={(v) => patchCard(i, { number: v })}
              placeholder="250"
            />
            <TextField
              label="Suffix"
              value={card.suffix ?? ''}
              onChange={(v) => patchCard(i, { suffix: v })}
              placeholder="M+"
            />
          </div>
          <TextField
            label="Label"
            value={card.label}
            onChange={(v) => patchCard(i, { label: v })}
            placeholder="Annual revenue"
          />
          <TextField
            label="Caption"
            value={card.caption ?? ''}
            onChange={(v) => patchCard(i, { caption: v })}
            textarea
            placeholder="Short supporting line."
          />
          <ColorField
            label="Bar color"
            value={card.barColor}
            onChange={(v) => patchCard(i, { barColor: v })}
          />
        </div>
      ))}

      <RowButton label="+ Add card" onClick={addCard} disabled={value.cards.length >= 4} />
    </div>
  );
}
