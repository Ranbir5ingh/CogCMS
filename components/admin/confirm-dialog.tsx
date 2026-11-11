'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';

/* The destructive-confirmation card used across the admin — blog, FAQ and
   whitepaper deletes, API key revokes. Markup lives here so the wording is the
   only thing a call site has to decide. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Yes, delete it',
  cancelLabel = 'Cancel',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content
          className="fixed left-[50%] top-[50%] z-[100] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-8 shadow-2xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-3xl"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 sm:mx-0">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <AlertDialog.Title className="mt-2 text-xl font-semibold tracking-tight text-gray-900">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm font-medium leading-relaxed text-gray-500">
              {description}
            </AlertDialog.Description>
          </div>
          <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3">
            <AlertDialog.Cancel asChild>
              <button className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 sm:mt-0 sm:w-auto">
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="inline-flex w-full justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500 sm:w-auto"
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
