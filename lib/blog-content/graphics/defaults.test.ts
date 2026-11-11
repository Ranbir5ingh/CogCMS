import { describe, it, expect } from 'vitest';
import { GRAPHIC_DEFAULTS } from './defaults';
import { graphicConfigSchema, type GraphicType } from './types';

describe('GRAPHIC_DEFAULTS', () => {
  const types: GraphicType[] = ['stat-cards', 'callout', 'comparison'];

  it('provides a default of the right shape for each graphic type', () => {
    for (const type of types) {
      expect(GRAPHIC_DEFAULTS[type]().type).toBe(type);
    }
  });

  it('starts text graphics blank but still schema-valid', () => {
    for (const type of ['callout', 'comparison'] as GraphicType[]) {
      expect(graphicConfigSchema.safeParse(GRAPHIC_DEFAULTS[type]()).success).toBe(true);
    }
  });

  it('rejects stat cards until a real number replaces the blank field', () => {
    const blank = GRAPHIC_DEFAULTS['stat-cards']();
    expect(graphicConfigSchema.safeParse(blank).success).toBe(false);

    const filled = {
      ...blank,
      cards: blank.cards.map((card) => ({ ...card, number: 12, label: 'Revenue' })),
    };
    expect(graphicConfigSchema.safeParse(filled).success).toBe(true);
  });

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = GRAPHIC_DEFAULTS['stat-cards']();
    const b = GRAPHIC_DEFAULTS['stat-cards']();
    expect(a).not.toBe(b);
    expect(a.type === 'stat-cards' && a.cards).not.toBe(b.type === 'stat-cards' && b.cards);
  });
});
