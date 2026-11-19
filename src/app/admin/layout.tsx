import { Suspense, type ReactNode } from "react";
import { AppShell, ShellSkeleton } from "@/components/shell";
import { requireAdmin } from "@/lib/auth";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return (
    <AppShell user={user} variant="admin">
      {children}
    </AppShell>
  );
}
