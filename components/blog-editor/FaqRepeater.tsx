'use client';

type Faq = { question: string; answer: string };

export default function FaqRepeater({
  value,
  onChange,
}: {
  value: Faq[];
  onChange: (v: Faq[]) => void;
}) {
  const update = (i: number, patch: Partial<Faq>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="flex flex-col gap-3">
      <label
        className="text-[12px] uppercase tracking-wider text-gray-400"
        style={{ fontWeight: 600 }}
      >
        FAQ
      </label>
      {value.map((f, i) => (
        <div key={i} className="p-3 rounded-lg border" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500">FAQ {i + 1}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              aria-label={`Remove FAQ ${i + 1}`}
              title={`Remove FAQ ${i + 1}`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-base leading-none text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              ×
            </button>
          </div>
          <input
            value={f.question}
            onChange={(e) => update(i, { question: e.target.value })}
            placeholder="Question"
            className="w-full mb-2 px-3 py-2 rounded-md border bg-gray-50/50 text-sm"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          />
          <textarea
            value={f.answer}
            onChange={(e) => update(i, { answer: e.target.value })}
            placeholder="Answer"
            className="w-full px-3 py-2 rounded-md border bg-gray-50/50 text-sm min-h-[64px]"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { question: '', answer: '' }])}
        className="self-start text-xs text-[#FF751F]"
      >
        + Add FAQ
      </button>
    </div>
  );
}
