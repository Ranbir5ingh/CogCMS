'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSite } from '@/components/admin/site-provider';
import { uploadImageDirect } from '@/lib/media/upload-client';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { useLeaveGuard } from '@/lib/admin/use-leave-guard';
import {
  makeFormStateKey,
  useSessionFormState,
  writeFormState,
} from '@/lib/admin/session-form-state';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { eventSlugSchema, optionalEventUrlSchema } from '@/lib/validation/event';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
type Format = 'online' | 'in-person' | 'hybrid';
type Form = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  imageUrl: string;
  imageAlt: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  format: Format;
  location: string;
  onlineUrl: string;
  registrationUrl: string;
  ticketPriceType: '' | 'free' | 'paid';
  ticketPriceAmount: string;
  ticketPriceCurrency: string;
  organizer: string;
  speakers: string;
  metaTitle: string;
  metaDescription: string;
};
const empty: Form = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  imageUrl: '',
  imageAlt: '',
  startAt: '',
  endAt: '',
  timeZone: 'UTC',
  format: 'online',
  location: '',
  onlineUrl: '',
  registrationUrl: '',
  ticketPriceType: 'free',
  ticketPriceAmount: '',
  ticketPriceCurrency: '',
  organizer: '',
  speakers: '',
  metaTitle: '',
  metaDescription: '',
};
const inputClass =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none focus:border-orange-500';
function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (name: string) => parts.find((item) => item.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
function toInstant(value: string, timeZone: string): string {
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) throw new Error('Enter a valid date and time.');
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const observed = Date.parse(`${localParts(new Date(instant), timeZone)}:00Z`);
    instant += target - observed;
  }
  if (localParts(new Date(instant), timeZone) !== value)
    throw new Error('This local time does not exist in the selected time zone.');
  return new Date(instant).toISOString();
}

function PickerSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open)
      list.current
        ?.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest' });
  }, [open]);
  return (
    <div
      className="relative min-w-0 flex-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-left text-sm text-stone-700 hover:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
      >
        <span className="truncate">
          {options.find((option) => option.value === value)?.label || value}
        </span>
        <span aria-hidden="true" className="text-stone-400">
          ⌄
        </span>
      </button>
      {open && (
        <div
          ref={list}
          role="listbox"
          aria-label={`${label} options`}
          className="absolute left-0 top-full z-30 mt-1 max-h-44 min-w-full overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${option.value === value ? 'bg-orange-50 text-orange-800' : 'text-stone-700 hover:bg-stone-100'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DateTimePicker({
  label,
  value,
  timeZone,
  open,
  onOpenChange,
  onChange,
}: {
  label: string;
  value: string;
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [month, setMonth] = useState(() => new Date());
  function showPicker() {
    let today: string;
    try {
      today = localParts(new Date(), timeZone).slice(0, 10);
    } catch {
      today = localParts(new Date(), 'UTC').slice(0, 10);
    }
    const initialDate = value.slice(0, 10) || today;
    const [year, monthNumber] = initialDate.split('-').map(Number);
    setDate(initialDate);
    setTime(value.slice(11, 16) || '09:00');
    setMonth(new Date(Date.UTC(year, monthNumber - 1, 1)));
    onOpenChange(true);
  }
  const year = month.getUTCFullYear();
  const monthNumber = month.getUTCMonth();
  const offset = new Date(Date.UTC(year, monthNumber, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber + 1, 0)).getUTCDate();
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: String(index),
    label: new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, index, 1)),
    ),
  }));
  const yearOptions = Array.from({ length: 201 }, (_, index) => ({
    value: String(year - 100 + index),
    label: String(year - 100 + index),
  }));
  const dateValue = (day: number) =>
    `${year}-${String(monthNumber + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const hour24 = Number(time.slice(0, 2)) || 0;
  const hour12 = hour24 % 12 || 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const minute = time.slice(3, 5) || '00';
  const minutes = Array.from({ length: 12 }, (_, index) => index * 5);
  if (!minutes.includes(Number(minute))) minutes.push(Number(minute));
  minutes.sort((a, b) => a - b);
  function setClock(hour: number, minutes: string, nextPeriod: string) {
    const nextHour = (hour % 12) + (nextPeriod === 'PM' ? 12 : 0);
    setTime(`${String(nextHour).padStart(2, '0')}:${minutes}`);
  }
  return (
    <div className="relative min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? onOpenChange(false) : showPicker())}
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className={value ? '' : 'text-stone-400'}>
          {value ? value.replace('T', ' · ') : 'Select date and time'}
        </span>
        <svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-stone-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"
          />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${label} date and time`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onOpenChange(false);
          }}
          className="absolute left-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-4rem))] rounded-xl border border-stone-200 bg-white p-3 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(new Date(Date.UTC(year, monthNumber - 1, 1)))}
              className="rounded-lg px-2 py-1 text-stone-600 hover:bg-stone-100"
            >
              ‹
            </button>
            <div className="flex min-w-0 flex-1 gap-2 px-2">
              <PickerSelect
                label="Month"
                value={String(monthNumber)}
                options={monthOptions}
                onChange={(value) => setMonth(new Date(Date.UTC(year, Number(value), 1)))}
              />
              <PickerSelect
                label="Year"
                value={String(year)}
                options={yearOptions}
                onChange={(value) => setMonth(new Date(Date.UTC(Number(value), monthNumber, 1)))}
              />
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(new Date(Date.UTC(year, monthNumber + 1, 1)))}
              className="rounded-lg px-2 py-1 text-stone-600 hover:bg-stone-100"
            >
              ›
            </button>
          </div>
          <div className="mt-1 grid grid-cols-7 text-center text-xs text-stone-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 text-center">
            {Array.from({ length: offset }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const dayValue = dateValue(day);
              return (
                <button
                  type="button"
                  key={day}
                  aria-label={dayValue}
                  aria-pressed={date === dayValue}
                  onClick={() => setDate(dayValue)}
                  className={`rounded-lg py-1 text-sm ${date === dayValue ? 'bg-orange-600 text-white' : 'text-stone-700 hover:bg-orange-50'}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <fieldset className="mt-2">
            <legend className="text-sm font-medium text-stone-700">Time</legend>
            <div className="mt-1 flex gap-2">
              <PickerSelect
                label="Hour"
                value={String(hour12)}
                options={Array.from({ length: 12 }, (_, index) => ({
                  value: String(index + 1),
                  label: String(index + 1).padStart(2, '0'),
                }))}
                onChange={(value) => setClock(Number(value), minute, period)}
              />
              <PickerSelect
                label="Minute"
                value={minute}
                options={minutes.map((value) => ({
                  value: String(value).padStart(2, '0'),
                  label: String(value).padStart(2, '0'),
                }))}
                onChange={(value) => setClock(hour12, value, period)}
              />
              <PickerSelect
                label="AM or PM"
                value={period}
                options={[
                  { value: 'AM', label: 'AM' },
                  { value: 'PM', label: 'PM' },
                ]}
                onChange={(value) => setClock(hour12, minute, value)}
              />
            </div>
          </fieldset>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!date || !time}
              onClick={() => {
                onChange(`${date}T${time}`);
                onOpenChange(false);
              }}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function Editor() {
  const site = useSite();
  const router = useRouter();
  const { showToast } = useToast();
  const search = useSearchParams();
  const editSlug = search.get('slug');
  const [form, setForm] = useState<Form>(empty);
  const [currencyCodes, setCurrencyCodes] = useState(['EUR', 'GBP', 'INR', 'USD']);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(empty));
  const [loading, setLoading] = useState(!!editSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'slug' | 'onlineUrl' | 'registrationUrl', string>>
  >({});
  const [dragging, setDragging] = useState(false);
  const [showImageUrl, setShowImageUrl] = useState(false);
  const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const currencyPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof Intl.supportedValuesOf === 'function')
      setCurrencyCodes(Intl.supportedValuesOf('currency'));
  }, []);
  useEffect(() => {
    if (!currencyOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!currencyPickerRef.current?.contains(event.target as Node)) setCurrencyOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCurrencyOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [currencyOpen]);
  useEffect(() => {
    if (!editSlug) {
      const initial = {
        ...empty,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      };
      setForm(initial);
      setSavedSnapshot(JSON.stringify(initial));
      return;
    }
    if (!site?.id) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/admin/events/${encodeURIComponent(editSlug)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const loaded: Form = {
          ...empty,
          ticketPriceType: '',
          ...Object.fromEntries(
            Object.keys(empty)
              .filter((key) => typeof data[key] === 'string')
              .map((key) => [key, data[key]]),
          ),
          startAt: localParts(new Date(data.startAt), data.timeZone),
          endAt: localParts(new Date(data.endAt), data.timeZone),
        };
        setForm(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          const message = err.message || TOAST_MESSAGES.events.loadFailed;
          setError(message);
          showToast('error', message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [editSlug, site?.id, showToast]);
  const isDirty = !loading && JSON.stringify(form) !== savedSnapshot;
  const storageKey = site?.id ? makeFormStateKey(site.id, 'event', editSlug) : null;
  const { clear: clearFormState } = useSessionFormState({
    storageKey,
    value: form,
    isDirty,
    ready: !loading,
    onRestore: (saved) => {
      const fields = Object.fromEntries(
        Object.keys(empty)
          .filter((key) => {
            const value = saved[key as keyof Form];
            return (
              typeof value === 'string' &&
              (key !== 'format' || ['online', 'in-person', 'hybrid'].includes(value)) &&
              (key !== 'ticketPriceType' || ['', 'free', 'paid'].includes(value))
            );
          })
          .map((key) => [key, saved[key as keyof Form]]),
      );
      setForm((current) => ({ ...current, ...fields }));
    },
  });
  useEffect(() => {
    if (!storageKey || !isDirty) return;
    const flush = () => {
      try {
        writeFormState(window.sessionStorage, storageKey, form);
      } catch {
        /* Storage may be unavailable. */
      }
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [storageKey, isDirty, form]);
  const leaveGuard = useLeaveGuard(isDirty, clearFormState);
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'link'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean'],
      ],
    }),
    [],
  );
  const set = (key: keyof Form, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (key === 'slug' || key === 'onlineUrl' || key === 'registrationUrl')
      setFieldErrors((previous) => ({ ...previous, [key]: undefined }));
  };
  function fieldError(
    key: 'slug' | 'onlineUrl' | 'registrationUrl',
    value: string,
  ): string | undefined {
    if (key === 'slug') {
      const parsed = eventSlugSchema.safeParse(value);
      return parsed.success ? undefined : parsed.error.issues[0]?.message;
    }
    if (key === 'onlineUrl' && form.format !== 'in-person' && !value.trim())
      return 'Enter an online event URL';
    return optionalEventUrlSchema.safeParse(value).success
      ? undefined
      : 'Enter a valid URL starting with http:// or https://';
  }
  async function save(status: 'draft' | 'publish') {
    if (!site?.id) {
      setError('Select a site first.');
      showToast('error', 'Select a site first.');
      return;
    }
    if (!form.ticketPriceType) {
      setError('Choose Free or Paid for ticket price.');
      showToast('error', 'Choose Free or Paid for ticket price.');
      return;
    }
    const linkErrors = {
      slug: fieldError('slug', form.slug),
      onlineUrl: form.format === 'in-person' ? undefined : fieldError('onlineUrl', form.onlineUrl),
      registrationUrl: fieldError('registrationUrl', form.registrationUrl),
    };
    setFieldErrors(linkErrors);
    if (Object.values(linkErrors).some(Boolean)) {
      setError('Check the highlighted URL fields before saving.');
      showToast('error', 'Check the highlighted URL fields before saving.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = {
        ...form,
        onlineUrl: form.format === 'in-person' ? '' : form.onlineUrl,
        startAt: toInstant(form.startAt, form.timeZone),
        endAt: toInstant(form.endAt, form.timeZone),
        status,
      };
      const res = await fetch(
        editSlug ? `/api/admin/events/${encodeURIComponent(editSlug)}` : '/api/admin/events',
        {
          method: editSlug ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        const fields = body.details?.fieldErrors;
        const first =
          fields &&
          Object.values(fields)
            .flat()
            .find((value) => typeof value === 'string');
        throw new Error(typeof first === 'string' ? first : body.error || 'Could not save event.');
      }
      showToast(
        'success',
        status === 'publish' ? TOAST_MESSAGES.events.published : TOAST_MESSAGES.events.draftSaved,
      );
      clearFormState();
      leaveGuard.leaveTo('/admin/dashboard/events');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save event.');
      showToast('error', err instanceof Error ? err.message : TOAST_MESSAGES.events.saveFailed);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || !site?.id) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the cover.');
      showToast('error', 'Choose an image file for the cover.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      set('imageUrl', await uploadImageDirect(file, site.id));
      showToast('success', TOAST_MESSAGES.events.coverUploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
      showToast('error', err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setBusy(false);
    }
  }
  const field = (
    label: string,
    key: keyof Form,
    options: { type?: string; placeholder?: string; maxLength?: number; hint?: string } = {},
  ) => (
    <label className="grid gap-1.5 text-sm font-medium text-stone-700">
      {label}
      <input
        className={inputClass}
        type={options.type || 'text'}
        maxLength={options.maxLength}
        placeholder={options.placeholder}
        value={form[key]}
        inputMode={key === 'ticketPriceAmount' ? 'decimal' : undefined}
        onChange={(event) => {
          const value = event.target.value;
          if (key === 'ticketPriceAmount') {
            const numeric = value.replace(/[^\d.]/g, '');
            if (/^\d{0,9}(?:\.\d{0,3})?$/.test(numeric)) set(key, numeric);
            return;
          }
          set(key, key === 'ticketPriceCurrency' ? value.toUpperCase() : value);
        }}
        aria-invalid={
          (key === 'slug' || key === 'onlineUrl' || key === 'registrationUrl') && !!fieldErrors[key]
        }
        onBlur={(event) => {
          if (key === 'slug' || key === 'onlineUrl' || key === 'registrationUrl')
            setFieldErrors((previous) => ({
              ...previous,
              [key]: fieldError(key, event.target.value),
            }));
        }}
      />
      {options.hint && <span className="text-xs font-normal text-stone-500">{options.hint}</span>}
      {(key === 'slug' || key === 'onlineUrl' || key === 'registrationUrl') && fieldErrors[key] && (
        <span role="alert" className="text-xs font-normal text-red-700">
          {fieldErrors[key]}
        </span>
      )}
    </label>
  );
  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <style jsx global>{`
        .event-description .ql-container {
          height: auto;
        }
        .event-description .ql-editor {
          height: 180px;
          overflow-y: auto;
        }
      `}</style>
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-stone-200 pb-7">
        <div>
          <Link className="text-sm font-medium text-orange-700" href="/admin/dashboard/events">
            ← Events
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {editSlug ? 'Edit event' : 'Create event'}
          </h1>
          <p className="mt-2 text-sm text-stone-500">Share an experience with your audience.</p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || loading}
            onClick={() => save('draft')}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            disabled={busy || loading}
            onClick={() => save('publish')}
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Publish event'}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p className="py-12 text-stone-500">Loading event…</p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0 space-y-5">
            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Event details</h2>
              <div>
                <p className="mb-2 text-sm font-medium text-stone-700">Cover image</p>
                {form.imageUrl ? (
                  <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-stone-100">
                    <img
                      src={form.imageUrl}
                      alt={form.imageAlt || 'Event cover'}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute right-3 top-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium shadow-sm disabled:opacity-50"
                      >
                        Change cover
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setForm((current) => ({ ...current, imageUrl: '', imageAlt: '' }));
                          if (fileInput.current) fileInput.current.value = '';
                        }}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-red-700 shadow-sm disabled:opacity-50"
                      >
                        Remove cover
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!busy) setDragging(true);
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                        setDragging(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      if (!busy) void upload(event.dataTransfer.files[0]);
                    }}
                    className={`flex min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-orange-500 bg-orange-50' : 'border-stone-200 bg-stone-50/50'}`}
                  >
                    <svg
                      aria-hidden="true"
                      className="mb-3 h-7 w-7 text-stone-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5z"
                      />
                    </svg>
                    <p className="text-sm font-medium text-stone-600">
                      {dragging ? 'Drop image here' : 'Add a cover image'}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      Drag and drop or choose a file · 16:9 recommended
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                      >
                        {busy ? 'Uploading…' : 'Choose image'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowImageUrl((current) => !current)}
                        aria-expanded={showImageUrl}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                      >
                        {showImageUrl ? 'Hide URL' : 'Paste URL'}
                      </button>
                    </div>
                    {showImageUrl && (
                      <div className="mt-3 flex w-full max-w-sm items-end gap-2">
                        <label className="min-w-0 flex-1 text-left text-xs font-medium text-stone-600">
                          Image URL
                          <input
                            className={`${inputClass} mt-1`}
                            type="url"
                            value={imageUrlInput}
                            onChange={(event) => setImageUrlInput(event.target.value)}
                            placeholder="https://example.com/image.jpg"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const url = new URL(imageUrlInput);
                              if (url.protocol !== 'https:' && url.protocol !== 'http:')
                                throw new Error();
                              set('imageUrl', url.toString());
                              setShowImageUrl(false);
                              setError('');
                            } catch {
                              setError('Enter a valid image URL.');
                            }
                          }}
                          className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  aria-label="Upload cover image"
                  disabled={busy}
                  onChange={(event) => {
                    void upload(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                  className="sr-only"
                />
                {form.imageUrl && (
                  <div className="mt-3">
                    {field('Image description', 'imageAlt', {
                      placeholder: 'Describe the image for screen readers',
                    })}
                  </div>
                )}
              </div>
              {field('Event title', 'title', {
                placeholder: 'Give your event a name',
                maxLength: 150,
                hint: 'Maximum 150 characters',
              })}
              {field('URL slug', 'slug', {
                placeholder: 'your-event-name',
                maxLength: 160,
                hint: 'Up to 160 lowercase letters, numbers and hyphens.',
              })}
              <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                Summary
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  rows={3}
                  maxLength={3000}
                  value={form.summary}
                  onChange={(e) => set('summary', e.target.value)}
                  placeholder="A short introduction for your event card"
                />
                <span className="text-xs font-normal text-stone-500">
                  {form.summary.length}/3000 characters
                </span>
              </label>
              <div>
                <span id="event-description-label" className="text-sm font-medium text-stone-700">
                  Description
                </span>
                <div
                  aria-labelledby="event-description-label"
                  className="event-description mt-2 min-w-0 overflow-hidden rounded-xl border border-stone-300 [&_.ql-toolbar.ql-snow]:border-0 [&_.ql-toolbar.ql-snow]:border-b [&_.ql-toolbar.ql-snow]:border-stone-200 [&_.ql-container.ql-snow]:border-0"
                >
                  <ReactQuill
                    theme="snow"
                    value={form.content}
                    onChange={(value) => set('content', value)}
                    modules={modules}
                    useSemanticHTML={false}
                    placeholder="Tell people what to expect…"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Date & location</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <DateTimePicker
                  label="Start"
                  value={form.startAt}
                  timeZone={form.timeZone}
                  open={openPicker === 'start'}
                  onOpenChange={(open) => setOpenPicker(open ? 'start' : null)}
                  onChange={(value) => set('startAt', value)}
                />
                <DateTimePicker
                  label="End"
                  value={form.endAt}
                  timeZone={form.timeZone}
                  open={openPicker === 'end'}
                  onOpenChange={(open) => setOpenPicker(open ? 'end' : null)}
                  onChange={(value) => set('endAt', value)}
                />
              </div>
              {field('Time zone (IANA)', 'timeZone', { placeholder: 'Asia/Kolkata' })}
              <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                Event format
                <select
                  className={inputClass}
                  value={form.format}
                  onChange={(e) => set('format', e.target.value)}
                >
                  <option value="online">Online</option>
                  <option value="in-person">In person</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
              {form.format !== 'online' && field('Venue and address', 'location')}
              {form.format !== 'in-person' &&
                field('Online event URL', 'onlineUrl', { type: 'url', placeholder: 'https://' })}
            </div>
            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">People & registration</h2>
              {field('Organiser', 'organizer')}
              {field('Speakers', 'speakers', { placeholder: 'Names separated by commas' })}
              {field('Registration URL', 'registrationUrl', {
                type: 'url',
                placeholder: 'https://',
              })}
              <label className="grid gap-1.5 text-sm font-medium text-stone-700">
                Ticket price
                <select
                  className={inputClass}
                  value={form.ticketPriceType}
                  onChange={(event) => {
                    const ticketPriceType = event.target.value as Form['ticketPriceType'];
                    setForm((current) => ({
                      ...current,
                      ticketPriceType,
                      ...(ticketPriceType === 'paid'
                        ? { ticketPriceCurrency: current.ticketPriceCurrency || 'INR' }
                        : { ticketPriceAmount: '', ticketPriceCurrency: '' }),
                    }));
                  }}
                >
                  {form.ticketPriceType === '' && <option value="">Select price</option>}
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              {form.ticketPriceType === 'paid' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('Amount', 'ticketPriceAmount', {
                    placeholder: 'e.g. 499.00',
                    maxLength: 13,
                  })}
                  <div
                    ref={currencyPickerRef}
                    className="relative grid gap-1.5 text-sm font-medium text-stone-700"
                  >
                    <span>Currency code</span>
                    <button
                      type="button"
                      className={`${inputClass} flex items-center justify-between text-left`}
                      aria-label="Currency code"
                      aria-expanded={currencyOpen}
                      aria-controls="event-currency-options"
                      onClick={() => {
                        setCurrencySearch('');
                        setCurrencyOpen((open) => !open);
                      }}
                    >
                      <span className={form.ticketPriceCurrency ? '' : 'text-stone-400'}>
                        {form.ticketPriceCurrency || 'Select currency'}
                      </span>
                      <span aria-hidden="true" className="text-stone-500">
                        ▾
                      </span>
                    </button>
                    {currencyOpen && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
                        <input
                          autoFocus
                          aria-label="Search currencies"
                          className="mb-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                          placeholder="Search currency code"
                          value={currencySearch}
                          onChange={(event) => setCurrencySearch(event.target.value.toUpperCase())}
                        />
                        <div id="event-currency-options" className="max-h-48 overflow-y-auto">
                          {[
                            ...new Set(
                              [form.ticketPriceCurrency, ...currencyCodes].filter(Boolean),
                            ),
                          ]
                            .filter((code) => code.includes(currencySearch))
                            .map((code) => (
                              <button
                                key={code}
                                type="button"
                                className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-orange-50 ${
                                  code === form.ticketPriceCurrency
                                    ? 'bg-orange-50 font-semibold text-orange-700'
                                    : 'text-stone-700'
                                }`}
                                onClick={() => {
                                  set('ticketPriceCurrency', code);
                                  setCurrencyOpen(false);
                                }}
                              >
                                {code}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Search appearance</h2>
              {field('SEO title', 'metaTitle')}
              {field('SEO description', 'metaDescription')}
            </div>
          </div>
          <aside className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <h2 className="text-sm font-semibold">Live preview</h2>
            <p className="mt-1 text-xs text-stone-500">
              Approximate preview; each website controls its own design.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-stone-200">
              <div className="flex h-40 items-center justify-center bg-orange-50 text-sm text-orange-800">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.imageAlt}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  'Event cover image'
                )}
              </div>
              <div className="space-y-3 break-words p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
                  {form.format.replace('-', ' ')}
                </p>
                <h3 className="text-xl font-semibold">{form.title || 'Your event title'}</h3>
                <p className="text-sm text-stone-600">
                  {form.summary || 'Your event summary will appear here.'}
                </p>
                <p className="text-sm text-stone-600">
                  {form.startAt ? form.startAt.replace('T', ' · ') : 'Date and time'} ·{' '}
                  {form.timeZone}
                </p>
                <p className="text-sm text-stone-600">
                  {form.format === 'online' ? 'Online event' : form.location || 'Event location'}
                </p>
                {form.ticketPriceType === 'free' && <p className="text-sm text-stone-600">Free</p>}
                {form.ticketPriceType === 'paid' &&
                  form.ticketPriceAmount &&
                  form.ticketPriceCurrency && (
                    <p className="text-sm text-stone-600">
                      {form.ticketPriceCurrency} {form.ticketPriceAmount}
                    </p>
                  )}
                <span className="inline-block rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white">
                  Register
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}
      <ConfirmDialog {...leaveGuard.dialogProps} />
    </section>
  );
}
export default function NewEventPage() {
  return (
    <Suspense fallback={<p>Loading editor…</p>}>
      <Editor />
    </Suspense>
  );
}
