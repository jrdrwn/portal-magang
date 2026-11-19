import { Suspense, type ReactNode } from "react";
import { AccountCard, AccountCardSkeleton, ShellFrame } from "@/components/shell";
import { requireIntern } from "@/lib/auth";

export default function InternLayout({ children }: { children: ReactNode }) {
  return (
    <ShellFrame
      variant="intern"
      account={
        <Suspense fallback={<AccountCardSkeleton />}>
          <InternAccount />
        </Suspense>
      }
    >
      {children}
    </ShellFrame>
  );
}

async function InternAccount() {
  const user = await requireIntern();
  return <AccountCard user={user} href="/profil" />;
}
