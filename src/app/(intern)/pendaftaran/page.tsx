import type { Metadata } from "next";
import { cancelRegistration, createRegistration } from "@/actions/registration";
import { ActionButton, ActionForm } from "@/components/ui/form";
import { RegistrationFields } from "@/components/registration-fields";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/ui";
import { requireIntern } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateKey, daysBetweenInclusive, formatDate } from "@/lib/dates";
import { internshipTypeInfo, registrationLabel } from "@/lib/labels";
import { getOpenTeams } from "@/lib/queries";

export const metadata: Metadata = { title: "Pendaftaran" };

export default async function RegistrationPage() {
  const user = await requireIntern();
  const today = dateKey();

  const [registrations, teams] = await Promise.all([
    db.registration.findMany({
      where: { userId: user.id },
      include: { team: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getOpenTeams(),
  ]);

  return (
    <>
      <PageHeader
        title="Pendaftaran magang"
        description="Pilih tim, jenis magang, dan periode magang. Admin akan meninjau pengajuan Anda."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card className="h-fit xl:sticky xl:top-6 self-start">
          <CardTitle title="Ajukan periode baru" />
          {teams.length === 0 ? (
            <EmptyState
              title="Belum ada tim yang membuka magang"
              description="Silakan cek kembali nanti."
            />
          ) : (
          <ActionForm action={createRegistration} submitLabel="Kirim pendaftaran" variant="brand" resetOnSuccess>
            <RegistrationFields teams={teams} today={today} />
          </ActionForm>
          )}
        </Card>

        <Card>
          <CardTitle title="Riwayat pendaftaran" />
          {registrations.length === 0 ? (
            <EmptyState
              title="Belum ada pendaftaran"
              description="Isi formulir di samping untuk mulai."
            />
          ) : (
            <ul className="space-y-3">
              {registrations.map((r) => (
                <li key={r.id} className="rounded-3xl bg-canvas/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{r.team.name}</p>
                      <div className="mt-1">
                        <Badge tone={internshipTypeInfo[r.type].tone}>
                          {internshipTypeInfo[r.type].label}
                          {r.graduationYear ? ` · lulus ${r.graduationYear}` : ""}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatDate(r.startDate)} – {formatDate(r.endDate)} ·{" "}
                        {daysBetweenInclusive(r.startDate, r.endDate)} hari
                      </p>
                    </div>
                    <Badge tone={registrationLabel[r.status].tone}>
                      {registrationLabel[r.status].label}
                    </Badge>
                  </div>
                  {r.reviewNote ? (
                    <p className="mt-3 rounded-2xl bg-white p-3 text-sm">
                      <span className="font-semibold">Catatan admin: </span>
                      {r.reviewNote}
                    </p>
                  ) : null}
                  {r.status === "PENDING" ? (
                    <div className="mt-3">
                      <ActionButton
                        action={cancelRegistration.bind(null, r.id)}
                        variant="danger"
                        confirmText="Batalkan pendaftaran ini?"
                        className="px-3 py-1.5 text-xs"
                      >
                        Batalkan
                      </ActionButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
