import type { Metadata } from "next";
import { cancelRegistration, createRegistration } from "@/actions/registration";
import { ActionButton, ActionForm, Field } from "@/components/ui/form";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateKey, daysBetweenInclusive, formatDate } from "@/lib/dates";
import { registrationLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Pendaftaran" };

export default async function RegistrationPage() {
  const user = await requireUser("INTERN");
  const today = dateKey();

  const registrations = await db.registration.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Pendaftaran magang"
        description="Tentukan divisi dan periode magang. Admin akan meninjau pengajuan Anda."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card className="h-fit">
          <CardTitle title="Ajukan periode baru" />
          <ActionForm action={createRegistration} submitLabel="Kirim pendaftaran" variant="brand" resetOnSuccess>
            <Field
              label="Divisi / bidang"
              name="division"
              placeholder="Contoh: Web Development"
              maxLength={60}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mulai" name="startDate" type="date" min={today} />
              <Field label="Selesai" name="endDate" type="date" min={today} />
            </div>
            <Field
              label="Motivasi"
              name="motivation"
              as="textarea"
              placeholder="Ceritakan singkat alasan dan tujuan magang Anda"
              maxLength={1000}
            />
          </ActionForm>
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
                      <p className="font-semibold">{r.division}</p>
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
