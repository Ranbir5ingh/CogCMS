'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminUserView } from '@/lib/admin/serializers';
import { RowActionsMenu, ROW_ACTION_ITEM_CLASS } from '@/components/admin/row-actions-menu';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/admin/users', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load users');
        setUsers(await response.json());
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-2 text-sm text-stone-600">Roles, site assignments, and account status.</p>
        </div>
        <Link href="/admin/dashboard/users/new" className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 active:translate-y-px">
          New user
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {state === 'loading' ? <p className="p-6 text-sm text-stone-500">Loading users...</p> : null}
        {state === 'error' ? <p role="alert" className="p-6 text-sm text-red-700">Users could not be loaded.</p> : null}
        {state === 'ready' && users.length === 0 ? <p className="p-6 text-sm text-stone-500">No users found.</p> : null}
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 last:border-b-0 hover:bg-orange-50/50">
            <span className="min-w-0">
              <span className="block truncate font-medium text-stone-900">{user.name}</span>
              <span className="mt-1 block truncate text-xs text-stone-500">{user.email}</span>
            </span>
            <span className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium capitalize text-stone-600">{user.role}</span>
              <span className={`rounded-full px-2.5 py-1 font-medium ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{user.status}</span>
              <RowActionsMenu label={`Actions for ${user.name}`}>
                <Link href={`/admin/dashboard/users/${user.id}`} className={ROW_ACTION_ITEM_CLASS}>
                  Edit
                </Link>
              </RowActionsMenu>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
