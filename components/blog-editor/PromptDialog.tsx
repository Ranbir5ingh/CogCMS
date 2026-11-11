'use client';

import { useEffect, useRef, useState } from 'react';

export interface PromptField {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: 'text' | 'number';
  helper?: string;
}

export interface PromptRequest {
  title: string;
  fields: PromptField[];
  submitLabel: string;
  validate: (values: Record<string, string>) => string | null;
  onSubmit: (values: Record<string, string>) => void;
}

export default function PromptDialog({
  request,
  onClose,
}: {
  request: PromptRequest;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(request.fields.map((field) => [field.name, field.defaultValue ?? ''])),
  );
  const [error, setError] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInput.current?.focus();
    firstInput.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    const message = request.validate(values);
    if (message) {
      setError(message);
      return;
    }
    request.onSubmit(values);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-2xl"
        style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#1a1a1a]">{request.title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-lg leading-none text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {request.fields.map((field, index) => (
          <label key={field.name} className="mb-3 block">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">{field.label}</span>
            <input
              ref={index === 0 ? firstInput : undefined}
              type={field.type ?? 'text'}
              value={values[field.name]}
              placeholder={field.placeholder}
              onChange={(event) => {
                setError(null);
                setValues((current) => ({ ...current, [field.name]: event.target.value }));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              style={{ borderColor: 'rgba(0,0,0,0.12)' }}
            />
            {field.helper ? (
              <span className="mt-1 block text-[11px] text-gray-400">{field.helper}</span>
            ) : null}
          </label>
        ))}

        {error ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50"
            style={{ borderColor: 'rgba(0,0,0,0.12)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-full px-5 py-2 text-[13px] text-white"
            style={{ background: '#FF751F' }}
          >
            {request.submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
