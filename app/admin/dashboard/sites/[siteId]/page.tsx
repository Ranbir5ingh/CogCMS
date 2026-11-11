'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { AdminSiteView } from '@/lib/admin/serializers';
import { SiteForm } from '@/components/admin/site-form';
import { ApiKeysPanel } from '@/components/admin/api-keys-panel';

export default function EditSitePage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<AdminSiteView | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/sites/${siteId}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load site');
        setSite(await response.json());
      })
      .catch(() => setError(true));
  }, [siteId]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          The site could not be loaded.
        </p>
      ) : null}
      {!error && !site ? <p className="text-sm text-stone-500">Loading site...</p> : null}
      {site ? (
        <>
          <SiteForm site={site} />
          <div className="max-w-4xl">
            <ApiKeysPanel siteId={site.id} />
          </div>
        </>
      ) : null}
    </section>
  );
}
