import Link from 'next/link';
import connectToDatabase from '@/lib/mongodb';
import { requireUser } from '@/lib/auth/require';
import { getCurrentSite } from '@/lib/site/context';
import Blog from '@/models/Blog';
import Event from '@/models/Event';
import Author from '@/models/Author';
import FAQ from '@/models/FAQ';
import Whitepaper from '@/models/Whitepaper';
import ReleaseNote from '@/models/ReleaseNote';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';

export default async function AdminDashboard() {
  const user = await requireUser();
  const site = await getCurrentSite(user);

  if (!site) {
    return (
      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-medium text-orange-700">Site selection required</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
          Choose the site you want to manage.
        </h1>
        <p className="mt-3 max-w-2xl text-stone-600">
          Content, counts, uploads, and public links are isolated by the active site.
        </p>
        {user.role === 'admin' ? (
          <Link
            href="/admin/dashboard/sites/new"
            className="mt-7 inline-flex rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 active:translate-y-px"
          >
            Create a site
          </Link>
        ) : (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Ask an administrator to assign an active site to your account.
          </p>
        )}
        <Link
          href="/admin/dashboard/connect"
          className="mt-5 block text-sm font-medium text-orange-800 underline underline-offset-4"
        >
          Read the website connection guide
        </Link>
      </section>
    );
  }

  await connectToDatabase();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [blogs, events, whitepapers, authors, faqs, releaseNotes, subscribers, recentBlogs] =
    await Promise.all([
      Blog.countDocuments({ siteId: site.id, status: 'publish' }),
      Event.countDocuments({ siteId: site.id, status: 'publish' }),
      Whitepaper.countDocuments({ siteId: site.id, status: 'publish' }),
      Author.countDocuments({ siteId: site.id, status: 'publish' }),
      FAQ.countDocuments({ siteId: site.id, status: 'publish' }),
      ReleaseNote.countDocuments({ siteId: site.id, status: 'publish' }),
      NewsletterSubscriber.countDocuments({ siteId: site.id }),
      Blog.countDocuments({ siteId: site.id, createdAt: { $gte: oneWeekAgo } }),
    ]);

  const modules = [
    ['Blogs', 'Write, review, and publish long-form content.', '/admin/dashboard/blogs', blogs],
    ['Events', 'Create and publish events for your audience.', '/admin/dashboard/events', events],
    ['Authors', 'Manage bylines and public author profiles.', '/admin/dashboard/authors', authors],
    ['FAQs', 'Maintain public answers and review submissions.', '/admin/dashboard/faqs', faqs],
    [
      'Whitepapers',
      'Publish research with site-specific links.',
      '/admin/dashboard/whitepapers',
      whitepapers,
    ],
    [
      'Release notes',
      'Publish versioned product updates.',
      '/admin/dashboard/release-notes',
      releaseNotes,
    ],
    [
      'Subscribers',
      'Review signups and export a site-scoped CSV.',
      '/admin/dashboard/subscribers',
      subscribers,
    ],
  ] as const;

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-orange-700">{site.name}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">Dashboard</h1>
          <p className="mt-2 text-sm text-stone-600">Your content and publishing workspace.</p>
        </div>
        <a
          href={site.primaryDomain}
          target="_blank"
          rel="noreferrer"
          className="w-fit rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:border-orange-300 hover:text-orange-700 active:translate-y-px"
        >
          Open public site
        </a>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/dashboard/blogs/new"
          className="rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800"
        >
          Write a blog
        </Link>
        <Link
          href="/admin/dashboard/connect"
          className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-100"
        >
          Website setup guide
        </Link>
      </div>

      <p className="mt-4 text-sm text-stone-500">
        {recentBlogs} blog posts created in the last 7 days.
      </p>

      <div className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-stone-900">Content library</h2>
          <span className="text-xs text-stone-600">Published content · total subscribers</span>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {modules.map(([label, description, href, count]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 last:border-0 hover:bg-stone-50"
            >
              <div>
                <h3 className="font-semibold text-stone-900">{label}</h3>
                <p className="mt-1.5 text-sm leading-6 text-stone-600">{description}</p>
              </div>
              <span className="flex shrink-0 items-center gap-5">
                <span className="min-w-8 text-right text-lg font-semibold tabular-nums">
                  {count}
                </span>
                <span aria-hidden="true" className="text-stone-500">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
