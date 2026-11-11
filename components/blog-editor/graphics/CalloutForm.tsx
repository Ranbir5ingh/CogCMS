'use client';

import type { CalloutConfig } from '@/lib/blog-content/graphics/types';
import { Field, TextField, ColorField, Toggle } from './controls';

export default function CalloutForm({
  value,
  onChange,
}: {
  value: CalloutConfig;
  onChange: (c: CalloutConfig) => void;
}) {
  return (
    <div>
      <Toggle
        label="Animate (reveal on scroll)"
        checked={value.animate}
        onChange={(animate) => onChange({ ...value, animate })}
      />

      <Field label="Style">
        <select
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          value={value.variant}
          onChange={(e) =>
            onChange({ ...value, variant: e.target.value as CalloutConfig['variant'] })
          }
        >
          <option value="quote">Quote (italic)</option>
          <option value="info">Info</option>
        </select>
      </Field>

      <TextField
        label="Eyebrow (optional)"
        value={value.eyebrow ?? ''}
        onChange={(v) => onChange({ ...value, eyebrow: v })}
        placeholder="KEY INSIGHT"
      />
      <TextField
        label="Text"
        value={value.text}
        onChange={(v) => onChange({ ...value, text: v })}
        textarea
        placeholder="A short, quotable statement worth highlighting."
      />
      <TextField
        label="Attribution (optional)"
        value={value.attribution ?? ''}
        onChange={(v) => onChange({ ...value, attribution: v })}
        placeholder="Sam Altman, OpenAI"
      />
      <ColorField
        label="Accent color"
        value={value.accentColor}
        onChange={(v) => onChange({ ...value, accentColor: v })}
      />
    </div>
  );
}
