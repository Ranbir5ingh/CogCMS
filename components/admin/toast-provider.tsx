'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastKind = 'success' | 'error';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export const TOAST_DURATION_MS = 5000;

interface ToastApi {
  showToast: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({
  children,
  duration = TOAST_DURATION_MS,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const lastId = useRef(0);

  const removeToast = useCallback((id: number) => {
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = (lastId.current += 1);
      setToasts((current) => [...current, { id, kind, message }]);
      timers.current.set(
        id,
        setTimeout(() => removeToast(id), duration),
      );
    },
    [removeToast, duration],
  );

  // Drop pending timers if the dashboard unmounts while a toast is still up.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-6 top-6 z-[110] flex flex-col items-end gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={`max-w-[min(24rem,calc(100vw-3rem))] rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              toast.kind === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside a ToastProvider.');
  return api;
}
