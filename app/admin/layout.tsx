import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/admin/toast-provider';


export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
