import { Suspense, type ReactNode } from "react";
import { AppShell, ShellSkeleton } from "@/components/shell";
import { requireIntern } from "@/lib/auth";

export default function InternLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <InternShell>{children}</InternShell>
    </Suspense>
  );
}

async function InternShell({ children }: { children: ReactNode }) {
  const user = await requireIntern();
  return (
    <AppShell user={user} variant="intern">
      {children}
    </AppShell>
  );
}
