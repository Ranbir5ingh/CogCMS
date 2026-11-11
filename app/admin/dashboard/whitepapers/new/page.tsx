'use client';

import { Suspense, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { contentToBlocks } from '@/lib/whitepaper-content';
import { WhitepaperArticle } from '@/components/preview/whitepaper-article';
import { useSite } from '@/components/admin/site-provider';
import { useToast } from '@/components/admin/toast-provider';
import { TOAST_MESSAGES } from '@/components/admin/toast-messages';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { makeFormStateKey, useSessionFormState } from '@/lib/admin/session-form-state';
import { useLeaveGuard } from '@/lib/admin/use-leave-guard';
import { useEditorBaseline } from '@/lib/admin/use-editor-baseline';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

interface WhitepaperFormData {
  title: string;
  slug: string;
  description: string;
  date: string;
  author: string;
  authorRole: string;
  readTime: string;
  tags: string;
  headline: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  content: string;
}

const DEFAULT_DATA: WhitepaperFormData = {
  title: '',
  slug: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  author: '',
  authorRole: '',
  readTime: '',
  tags: '',
  headline: '',
  stat1Value: '',
  stat1Label: '',
  stat2Value: '',
  stat2Label: '',
  metaTitle: '',
  metaDescription: '',
  keywords: '',
  content: '',
};

// Character limits per field; the Field component reads its own limit from here.
const LIMITS: Partial<Record<keyof WhitepaperFormData, number>> = {
  title: 150,
  slug: 160,
  description: 3000,
  author: 80,
  authorRole: 80,
  readTime: 20,
  tags: 200,
  headline: 150,
  stat1Value: 20,
  stat1Label: 80,
  stat2Value: 20,
  stat2Label: 80,
  metaTitle: 70,
  metaDescription: 160,
  keywords: 250,
};
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 30;

const FALLBACK_AUTHOR = 'Research Team';
const FALLBACK_AUTHOR_ROLE = 'AI Search Strategist';
const FALLBACK_TAGS = ['AEO', 'GEO', 'AI Search'];
const PREVIEW_CONTENT =
  '<h1>Whitepaper Title</h1><h2>Executive Summary</h2><p>Write your whitepaper content in the editor.</p>';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function estimateReadTime(content: string) {
  const plainText = content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*`\[\]_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) {
    return '1 min read';
  }

  const words = plainText.split(' ').filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 238));
  return `${minutes} min read`;
}

function formatPreviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function WhitepaperEditorForm() {
  const site = useSite();
  const searchParams = useSearchParams();
  const editSlug = searchParams.get('slug');

  const [formData, setFormData] = useState<WhitepaperFormData>(DEFAULT_DATA);
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invalidField, setInvalidField] = useState<keyof WhitepaperFormData | null>(null);
  const [loadingData, setLoadingData] = useState(!!editSlug);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(DEFAULT_DATA));
  const isDirty = JSON.stringify(formData) !== savedSnapshot;
  const { showToast } = useToast();

  useEffect(() => {
    if (!editSlug) return;

    setLoadingData(true);
    setOriginalSlug(editSlug);

    fetch(`/api/admin/whitepapers/${editSlug}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          showToast('error', data.error || TOAST_MESSAGES.whitepapers.loadFailed);
          return;
        }

        const tags = Array.isArray(data.tags)
          ? data.tags.join(', ')
          : typeof data.tags === 'string'
            ? data.tags
            : data.tag || '';

        const loaded: WhitepaperFormData = {
          title: data.title || '',
          slug: data.slug || '',
          description: data.description || data.excerpt || '',
          date: data.date
            ? String(data.date).slice(0, 10)
            : data.createdAt
              ? new Date(data.createdAt).toISOString().slice(0, 10)
              : DEFAULT_DATA.date,
          author: data.author || FALLBACK_AUTHOR,
          authorRole: data.authorRole || '',
          readTime: data.readTime || '',
          tags,
          headline: data.headline || '',
          stat1Value: data.stat1Value || '',
          stat1Label: data.stat1Label || '',
          stat2Value: data.stat2Value || '',
          stat2Label: data.stat2Label || '',
          metaTitle: data.metaTitle || '',
          metaDescription: data.metaDescription || '',
          keywords: data.keywords || '',
          content: data.content || '',
        };
        setFormData(loaded);
        setSavedSnapshot(JSON.stringify(loaded));

        setSlugManuallyEdited(true);
      })
      .catch((fetchError) => {
        console.error(fetchError);
        showToast('error', TOAST_MESSAGES.whitepapers.loadFailed);
      })
      .finally(() => setLoadingData(false));
  }, [editSlug, showToast]);

  const editorBaseline = useEditorBaseline(editSlug);
  const { clear: clearFormState } = useSessionFormState({
    storageKey: site?.id ? makeFormStateKey(site.id, 'whitepaper', editSlug) : null,
    value: formData,
    isDirty,
    ready: !loadingData,
    onRestore: (saved) => {
      editorBaseline.stop();
      setFormData((prev) => ({ ...prev, ...saved }));
      if (typeof saved.slug === 'string' && typeof saved.title === 'string') {
        setSlugManuallyEdited(saved.slug !== slugify(saved.title));
      }
    },
  });
  const leaveGuard = useLeaveGuard(isDirty, clearFormState);

  const computedReadTime = useMemo(() => estimateReadTime(formData.content), [formData.content]);
  const quillModules = useMemo(
    () => ({
      toolbar: {
        container: '#whitepaper-editor-toolbar',
        handlers: {
          divider(this: any) {
            const range = this.quill.getSelection(true);
            const index = range ? range.index : this.quill.getLength();
            this.quill.clipboard.dangerouslyPasteHTML(index, '<hr><p><br></p>');
            this.quill.setSelection(index + 1);
          },
        },
      },
    }),
    [],
  );
  const quillFormats = ['header', 'list', 'bullet'];

  const previewWhitepaper = useMemo(() => {
    const tags = formData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const readTime = formData.readTime || computedReadTime;

    return {
      title: formData.title || 'Your Whitepaper Title',
      description: formData.description || 'Short description',
      dateFormatted: formatPreviewDate(formData.date || DEFAULT_DATA.date),
      author: formData.author || FALLBACK_AUTHOR,
      authorRole: formData.authorRole || FALLBACK_AUTHOR_ROLE,
      readTime,
      tags: tags.length > 0 ? tags : FALLBACK_TAGS,
      headline: formData.headline || formData.title || 'Headline',
      stat1Value: formData.stat1Value,
      stat1Label: formData.stat1Label,
      stat2Value: formData.stat2Value,
      stat2Label: formData.stat2Label,
      blocks: contentToBlocks(formData.content || PREVIEW_CONTENT),
    };
  }, [computedReadTime, formData]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (invalidField === name) setInvalidField(null);

    if (name === 'slug') {
      setSlugManuallyEdited(true);
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const title = e.target.value;
    if (invalidField === 'title') setInvalidField(null);
    setFormData((prev) => ({
      ...prev,
      title,
      slug: slugManuallyEdited ? prev.slug : slugify(title),
      headline: prev.headline || title,
    }));
  };

  const handleSubmit = async (status: 'draft' | 'publish') => {
    if (!formData.title.trim()) {
      showToast('error', TOAST_MESSAGES.whitepapers.titleRequired);
      return;
    }

    if (!formData.slug.trim()) {
      showToast('error', TOAST_MESSAGES.whitepapers.slugRequired);
      return;
    }

    if (!formData.description.trim()) {
      showToast('error', TOAST_MESSAGES.whitepapers.descriptionRequired);
      return;
    }

    if (!formData.content.trim()) {
      showToast('error', TOAST_MESSAGES.whitepapers.contentRequired);
      return;
    }

    // Inputs cap typing at the limit; this catches older whitepapers saved before it.
    const overLimit = (Object.keys(LIMITS) as (keyof WhitepaperFormData)[]).find(
      (key) => formData[key].length > LIMITS[key]!,
    );
    if (overLimit) {
      setInvalidField(overLimit);
      showToast('error', TOAST_MESSAGES.whitepapers.fieldTooLong);
      return;
    }

    const tagList = formData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tagList.length > MAX_TAGS) {
      setInvalidField('tags');
      showToast('error', TOAST_MESSAGES.whitepapers.tooManyTags);
      return;
    }
    if (tagList.some((tag) => tag.length > MAX_TAG_LENGTH)) {
      setInvalidField('tags');
      showToast('error', TOAST_MESSAGES.whitepapers.tagTooLong);
      return;
    }

    setLoading(true);

    const isEdit = !!originalSlug;
    const enteredTags = formData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const tagsArray = enteredTags.length > 0 || isEdit ? enteredTags : FALLBACK_TAGS;

    const payload = {
      title: formData.title,
      slug: formData.slug,
      description: formData.description,
      excerpt: formData.description,
      date: formData.date,
      author: formData.author || FALLBACK_AUTHOR,
      authorRole: formData.authorRole || (isEdit ? '' : FALLBACK_AUTHOR_ROLE),
      readTime: formData.readTime || computedReadTime,
      tags: tagsArray,
      tag: tagsArray[0] || 'Research',
      headline: formData.headline || formData.title,
      stat1Value: formData.stat1Value,
      stat1Label: formData.stat1Label,
      stat2Value: formData.stat2Value,
      stat2Label: formData.stat2Label,
      metaTitle: formData.metaTitle,
      metaDescription: formData.metaDescription,
      keywords: formData.keywords,
      content: formData.content,
      status,
    };

    try {
      const endpoint = isEdit ? `/api/admin/whitepapers/${originalSlug}` : '/api/admin/whitepapers';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || TOAST_MESSAGES.whitepapers.saveFailed);
        return;
      }

      showToast(
        'success',
        status === 'publish'
          ? isEdit
            ? TOAST_MESSAGES.whitepapers.republished
            : TOAST_MESSAGES.whitepapers.published
          : TOAST_MESSAGES.whitepapers.draftSaved,
      );
      clearFormState();
      leaveGuard.leaveTo('/admin/dashboard/whitepapers');
    } catch (submitError: any) {
      showToast('error', submitError.message || TOAST_MESSAGES.whitepapers.saveFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-col gap-5 border-b border-stone-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/dashboard/whitepapers"
            className="text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            ← Whitepapers
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {editSlug ? 'Edit whitepaper' : 'New whitepaper'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={loading || loadingData}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('publish')}
            disabled={loading || loadingData}
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </div>

      {loadingData ? (
        <p className="py-12 text-sm text-stone-500">Loading whitepaper…</p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-start">
          <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Title"
                name="title"
                invalid={invalidField === 'title'}
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="e.g. The State of AI Search 2026"
              />
              <Field
                label="Slug"
                name="slug"
                invalid={invalidField === 'slug'}
                value={formData.slug}
                onChange={handleChange}
                placeholder="generated-from-title"
              />
              <Field
                label="Description"
                name="description"
                invalid={invalidField === 'description'}
                value={formData.description}
                onChange={handleChange}
                placeholder="A short summary of the whitepaper"
                multiline
              />
              <Field
                label="Date"
                name="date"
                invalid={invalidField === 'date'}
                value={formData.date}
                onChange={handleChange}
                type="date"
              />
              <Field
                label="Author"
                name="author"
                invalid={invalidField === 'author'}
                value={formData.author}
                onChange={handleChange}
                placeholder={FALLBACK_AUTHOR}
              />
              <Field
                label="Author Role"
                name="authorRole"
                invalid={invalidField === 'authorRole'}
                value={formData.authorRole}
                onChange={handleChange}
                placeholder={FALLBACK_AUTHOR_ROLE}
              />
              <Field
                label="Read Time"
                name="readTime"
                invalid={invalidField === 'readTime'}
                value={formData.readTime}
                onChange={handleChange}
                placeholder={computedReadTime}
                hint={`Auto: ${computedReadTime}`}
              />
              <Field
                label="Tags (comma separated)"
                name="tags"
                invalid={invalidField === 'tags'}
                value={formData.tags}
                onChange={handleChange}
                placeholder={FALLBACK_TAGS.join(', ')}
              />
              <Field
                label="Headline"
                name="headline"
                invalid={invalidField === 'headline'}
                value={formData.headline}
                onChange={handleChange}
                placeholder="e.g. Winning visibility in AI answers"
              />
              <Field
                label="Stat 1 Value"
                name="stat1Value"
                invalid={invalidField === 'stat1Value'}
                value={formData.stat1Value}
                onChange={handleChange}
                placeholder="e.g. 68%"
              />
              <Field
                label="Stat 1 Label"
                name="stat1Label"
                invalid={invalidField === 'stat1Label'}
                value={formData.stat1Label}
                onChange={handleChange}
                placeholder="e.g. of buyers start research in AI search"
              />
              <Field
                label="Stat 2 Value"
                name="stat2Value"
                invalid={invalidField === 'stat2Value'}
                value={formData.stat2Value}
                onChange={handleChange}
                placeholder="e.g. 3x"
              />
              <Field
                label="Stat 2 Label"
                name="stat2Label"
                invalid={invalidField === 'stat2Label'}
                value={formData.stat2Label}
                onChange={handleChange}
                placeholder="e.g. more citations in AI answers"
              />
              <Field
                label="Meta Title"
                name="metaTitle"
                invalid={invalidField === 'metaTitle'}
                value={formData.metaTitle}
                onChange={handleChange}
                placeholder="Title shown in search results"
              />
              <Field
                label="Meta Description"
                name="metaDescription"
                invalid={invalidField === 'metaDescription'}
                value={formData.metaDescription}
                onChange={handleChange}
                placeholder="Description shown in search results"
                multiline
              />
              <Field
                label="Keywords"
                name="keywords"
                invalid={invalidField === 'keywords'}
                value={formData.keywords}
                onChange={handleChange}
                placeholder="e.g. AEO, GEO, AI search"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Whitepaper Content
              </label>
              <div className="mt-2 min-h-[420px] rounded-xl border border-stone-200 bg-white p-1">
                <div
                  id="whitepaper-editor-toolbar"
                  className="rounded-t-lg border-b border-stone-200 bg-stone-50 px-2 py-1.5"
                >
                  <span className="ql-formats">
                    <button className="ql-header" value="1" />
                    <button className="ql-header" value="2" />
                    <button className="ql-header" value="3" />
                  </span>
                  <span className="ql-formats">
                    <button className="ql-list" value="ordered" />
                    <button className="ql-list" value="bullet" />
                  </span>
                  <span className="ql-formats">
                    <button className="ql-divider" type="button">
                      HR
                    </button>
                  </span>
                </div>
                <ReactQuill
                  useSemanticHTML={false}
                  theme="snow"
                  value={formData.content}
                  onChange={(value: string, _delta: unknown, source: string) => {
                    setFormData((prev) => ({ ...prev, content: value }));
                    if (editorBaseline.acceptsNormalisation(source)) {
                      setSavedSnapshot((snapshot) =>
                        JSON.stringify({ ...JSON.parse(snapshot), content: value }),
                      );
                    }
                  }}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Write your whitepaper content..."
                />
              </div>
            </div>
          </div>

          <aside className="sticky top-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Live preview</h2>
              <p className="mt-1 text-xs text-stone-500">
                This renders the same layout the public whitepaper page uses.
              </p>
            </div>
            <div className="max-h-[calc(100vh-190px)] overflow-y-auto rounded-2xl border border-stone-200 bg-white">
              <div className="pointer-events-none">
                <WhitepaperArticle wp={previewWhitepaper} />
              </div>
            </div>
            <p className="mt-4 truncate text-xs text-stone-500">
              URL: {site?.publicPaths.whitepapers ?? '/whitepapers'}/{formData.slug || 'your-slug'}
            </p>
          </aside>
        </div>
      )}
      <ConfirmDialog {...leaveGuard.dialogProps} />
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  multiline = false,
  type = 'text',
  placeholder,
  hint,
  invalid = false,
}: {
  label: string;
  name: keyof WhitepaperFormData;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
  invalid?: boolean;
}) {
  const maxLength = LIMITS[name];
  const inputClass = `rounded-xl border px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-stone-900 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-orange-200 ${
    invalid ? 'border-red-500' : 'border-stone-200'
  }`;

  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
      {label}
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`${inputClass} min-h-[88px]`}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          className={inputClass}
        />
      )}
      {(hint || maxLength) && (
        <span className="flex justify-between gap-2 text-[11px] font-normal normal-case tracking-normal text-stone-400">
          <span>{hint}</span>
          {maxLength && (
            <span className={value.length > maxLength ? 'text-red-600' : undefined}>
              {value.length}/{maxLength}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

export default function NewWhitepaperPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFAF7]" />}>
      <WhitepaperEditorForm />
    </Suspense>
  );
}
