import { connection } from "next/server";
import { UsersRound } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { getOpenTeams } from "@/lib/queries";

/** Daftar tim yang membuka pendaftaran. Dibaca saat request agar selalu terbaru. */
export async function OpenTeams({ compact = false }: { compact?: boolean }) {
  await connection();
  const teams = await getOpenTeams();

  if (teams.length === 0) {
    return (
      <p className="rounded-3xl bg-surface p-5 text-sm text-muted shadow-card">
        Belum ada tim yang membuka pendaftaran saat ini.
      </p>
    );
  }

  if (compact) {
    return (
      <ul className="flex flex-wrap gap-2" aria-label="Tim yang membuka pendaftaran">
        {teams.map((t) => (
          <li
            key={t.id}
            title={t.description ?? undefined}
            className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
          >
            {t.name}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((t) => (
        <li key={t.id} className="flex gap-3 rounded-3xl bg-surface p-5 shadow-card">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
            <UsersRound className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{t.name}</p>
            {t.description ? <p className="mt-0.5 text-sm text-muted">{t.description}</p> : null}
            {t.regClosesAt || t.quota != null ? (
              <p className="mt-1.5 text-xs font-semibold text-brand-700">
                {[t.regClosesAt ? `Tutup ${formatDate(t.regClosesAt)}` : null, t.quota != null ? `Kuota ${t.quota} orang` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OpenTeamsSkeleton({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <div className="h-8 w-64 animate-pulse rounded-full bg-surface" />
  ) : (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-3xl bg-surface" />
      ))}
    </div>
  );
}
