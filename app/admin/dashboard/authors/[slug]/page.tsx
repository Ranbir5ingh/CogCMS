'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuthorForm, type AdminAuthorView } from '@/components/admin/author-form';

export default function EditAuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [author, setAuthor] = useState<AdminAuthorView | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/authors/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load author');
        setAuthor(await response.json());
      })
      .catch(() => setError(true));
  }, [slug]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          The author could not be loaded.
        </p>
      ) : null}
      {!error && !author ? <p className="text-sm text-stone-500">Loading author...</p> : null}
      {author ? <AuthorForm author={author} /> : null}
    </section>
  );
}
