'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

const contentLinks = [
  ['Dashboard', '/admin/dashboard'],
  ['Blogs', '/admin/dashboard/blogs'],
  ['Events', '/admin/dashboard/events'],
  ['Authors', '/admin/dashboard/authors'],
  ['FAQs', '/admin/dashboard/faqs'],
  ['Whitepapers', '/admin/dashboard/whitepapers'],
  ['Release notes', '/admin/dashboard/release-notes'],
  ['Subscribers', '/admin/dashboard/subscribers'],
] as const;

export function AdminNavigation({
  isAdmin,
  hasSite,
  children,
}: {
  isAdmin: boolean;
  hasSite: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = [
    { label: 'Content', links: contentLinks },
    {
      label: 'Workspace',
      links: [
        ...(isAdmin
          ? [
              ['Sites', '/admin/dashboard/sites'],
              ['Users', '/admin/dashboard/users'],
            ]
          : []),
        ['Connect a website', '/admin/dashboard/connect'],
      ],
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="cms-navigation"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-medium lg:hidden"
      >
        {open ? 'Close navigation' : 'Open navigation'}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div id="cms-navigation" className={`${open ? 'flex' : 'hidden'} flex-1 flex-col lg:flex`}>
        <nav aria-label="CMS navigation" className="mt-4 space-y-6 lg:mt-0 lg:pb-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-xs font-medium text-stone-500">{group.label}</p>
              <div className="space-y-1">
                {group.links.map(([label, href]) => {
                  const active =
                    pathname === href ||
                    (href !== '/admin/dashboard' && pathname.startsWith(`${href}/`));
                  const disabled =
                    group.label === 'Content' && href !== '/admin/dashboard' && !hasSite;
                  return disabled ? (
                    <span
                      key={href}
                      aria-disabled="true"
                      className="block rounded-lg px-3 py-2 text-sm text-stone-500"
                    >
                      {label}
                    </span>
                  ) : (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-orange-50 text-orange-800' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'}`}
                    >
                      {label}
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-orange-700"
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
