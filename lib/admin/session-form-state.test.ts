import { describe, expect, it } from 'vitest';
import {
  makeFormStateKey,
  nextMirrorAction,
  readFormState,
  removeFormState,
  stripFields,
  writeFormState,
  type StorageLike,
} from './session-form-state';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('makeFormStateKey', () => {
  it('scopes by site, form and record', () => {
    expect(makeFormStateKey('site-1', 'blog', 'my-post')).toBe('cms-form:v1:site-1:blog:my-post');
  });

  it('uses "new" when there is no record yet', () => {
    expect(makeFormStateKey('site-1', 'blog', null)).toBe('cms-form:v1:site-1:blog:new');
    expect(makeFormStateKey('global', 'user', '')).toBe('cms-form:v1:global:user:new');
  });
});

describe('stripFields', () => {
  it('drops excluded fields without touching the original', () => {
    const form = { email: 'a@b.co', password: 'secret' };
    expect(stripFields(form, ['password'])).toEqual({ email: 'a@b.co' });
    expect(form.password).toBe('secret');
  });
});

describe('write/read/remove', () => {
  it('round-trips form values', () => {
    const storage = memoryStorage();
    writeFormState(storage, 'k', { title: 'Hello', tags: ['a'] });
    expect(readFormState(storage, 'k')).toEqual({ title: 'Hello', tags: ['a'] });
    removeFormState(storage, 'k');
    expect(readFormState(storage, 'k')).toBeNull();
  });

  it('never stores excluded fields', () => {
    const storage = memoryStorage();
    writeFormState(storage, 'k', { email: 'a@b.co', password: 'secret' }, ['password']);
    expect(storage.data.get('k')).not.toContain('secret');
  });

  it('ignores corrupt or non-object values', () => {
    const storage = memoryStorage();
    storage.setItem('bad', '{not json');
    storage.setItem('array', '[1,2]');
    storage.setItem('text', '"hello"');
    expect(readFormState(storage, 'bad')).toBeNull();
    expect(readFormState(storage, 'array')).toBeNull();
    expect(readFormState(storage, 'text')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    expect(() => writeFormState(throwingStorage, 'k', { a: 1 })).not.toThrow();
    expect(readFormState(throwingStorage, 'k')).toBeNull();
    expect(() => removeFormState(throwingStorage, 'k')).not.toThrow();
    expect(readFormState(null, 'k')).toBeNull();
  });
});

describe('nextMirrorAction', () => {
  it('keeps the stored copy on the render that applies a restore', () => {
    expect(nextMirrorAction({ isDirty: false, justRestored: true })).toBe('keep');
  });

  it('removes the copy once the form is clean', () => {
    expect(nextMirrorAction({ isDirty: false, justRestored: false })).toBe('remove');
  });

  it('writes while the form has unsaved changes', () => {
    expect(nextMirrorAction({ isDirty: true, justRestored: true })).toBe('write');
    expect(nextMirrorAction({ isDirty: true, justRestored: false })).toBe('write');
  });
});
