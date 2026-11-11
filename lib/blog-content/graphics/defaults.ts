import type { GraphicType, StatCardsConfig, CalloutConfig, ComparisonConfig } from './types';

/* Starter configs for the insert flow — a fresh object per call so each inserted
   graphic owns its state. Text fields start empty so the author types into a blank
   field instead of clearing sample copy; the sample wording lives in the form
   placeholders. Numbers start as NaN, which zod rejects, so a stat card cannot be
   saved until a real figure is entered. */

const BRAND = '#FF751F';

export const GRAPHIC_DEFAULTS: {
  'stat-cards': () => StatCardsConfig;
  callout: () => CalloutConfig;
  comparison: () => ComparisonConfig;
} & Record<GraphicType, () => StatCardsConfig | CalloutConfig | ComparisonConfig> = {
  'stat-cards': () => ({
    type: 'stat-cards',
    animate: true,
    cards: [
      { number: Number.NaN, label: '', barColor: BRAND, caption: '' },
      { number: Number.NaN, label: '', barColor: BRAND, caption: '' },
      { number: Number.NaN, label: '', barColor: BRAND, caption: '' },
    ],
  }),
  callout: () => ({
    type: 'callout',
    animate: true,
    eyebrow: '',
    text: '',
    attribution: '',
    accentColor: BRAND,
    variant: 'quote',
  }),
  comparison: () => ({
    type: 'comparison',
    animate: true,
    accentColor: BRAND,
    columns: [
      { heading: '', points: ['', ''] },
      { heading: '', points: ['', ''] },
    ],
  }),
};
