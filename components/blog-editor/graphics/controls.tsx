'use client';

import React from 'react';

/* Small shared form controls for the graphic editor forms — keeps the three forms
   consistent and free of duplicated input markup. */

const inputCls =
  'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-orange-200';
const inputStyle = { borderColor: 'rgba(0,0,0,0.12)' } as const;

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <Field label={label}>
      {textarea ? (
        <textarea
          className={inputCls}
          style={inputStyle}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={inputCls}
          style={inputStyle}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={inputCls}
        style={inputStyle}
        placeholder={placeholder}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
      />
    </Field>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border p-0.5"
          style={inputStyle}
        />
        <input
          className={inputCls}
          style={inputStyle}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </Field>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 mb-4 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#FF751F] w-4 h-4"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export function RemoveButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-base leading-none text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
    >
      ×
    </button>
  );
}

export function RowButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${
        danger
          ? 'text-red-500 hover:bg-red-50 border-red-200'
          : 'text-gray-600 hover:border-[#FF751F] hover:text-[#FF751F]'
      }`}
      style={danger ? undefined : { borderColor: 'rgba(0,0,0,0.12)' }}
    >
      {label}
    </button>
  );
}
