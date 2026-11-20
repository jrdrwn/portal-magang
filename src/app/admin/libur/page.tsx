import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { createHoliday, deleteHoliday, updateWorkDays } from "@/actions/calendar";
import { ActionButton, ActionForm, ComboboxField, Field } from "@/components/ui/form";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { WEEKDAYS, parseWorkDays } from "@/lib/calendar";
import { db } from "@/lib/db";
import { dateKey, formatDate, formatWeekday } from "@/lib/dates";
import { getOfficeSetting } from "@/lib/queries";
import type { HolidayKind } from "@/generated/prisma/enums";
import type { Tone } from "@/lib/labels";

export const metadata: Metadata = { title: "Hari kerja & libur" };

const kindLabel: Record<HolidayKind, { label: string; tone: Tone }> = {
  NATIONAL: { label: "Libur nasional", tone: "danger" },
  JOINT_LEAVE: { label: "Cuti bersama", tone: "warning" },
  OFFICE: { label: "Libur kantor", tone: "info" },
};

export default async function HolidaysPage({ searchParams }: PageProps<"/admin/libur">) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const thisYear = Number(dateKey().slice(0, 4));
  const raw = Number(Array.isArray(sp.year) ? sp.year[0] : sp.year);
  const year = Number.isInteger(raw) && raw >= 2000 && raw <= 2100 ? raw : thisYear;

  const [office, holidays, years] = await Promise.all([
    getOfficeSetting(),
    db.holiday.findMany({
      where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      orderBy: { date: "asc" },
    }),
    db.$queryRaw<{ y: number }[]>`SELECT DISTINCT EXTRACT(YEAR FROM "date")::int AS y FROM "Holiday" ORDER BY y`,
  ]);
  const workDays = parseWorkDays(office.workDays);
  const yearOptions = [...new Set([...years.map((r) => r.y), thisYear, thisYear + 1])].sort();

  return (
    <>
      <PageHeader
        title="Hari kerja & libur"
        description="Dipakai untuk absensi dan perhitungan alpa. Absen tidak bisa dilakukan di hari libur atau di luar hari kerja."
      />

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="h-fit space-y-6 self-start xl:sticky xl:top-6">
          <Card>
            <CardTitle title="Hari kerja" />
            <ActionForm action={updateWorkDays} submitLabel="Simpan hari kerja" idPrefix="wd-">
              <fieldset>
                <legend className="sr-only">Hari kerja</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => (
                    <label
                      key={d.value}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-canvas/60 px-3.5 py-2 text-sm font-semibold transition has-checked:border-brand-500 has-checked:bg-brand-600 has-checked:text-white"
                    >
                      <input
                        type="checkbox"
                        name="workDays"
                        value={d.value}
                        defaultChecked={workDays.has(d.value)}
                        className="sr-only"
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </ActionForm>
          </Card>

          <Card>
            <CardTitle title="Tambah hari libur" hint="Contoh: libur kantor, cuti bersama tambahan." />
            <ActionForm action={createHoliday} submitLabel="Tambah" variant="brand" resetOnSuccess idPrefix="h-">
              <Field label="Tanggal" name="date" type="date" />
              <Field label="Keterangan" name="name" maxLength={100} placeholder="Contoh: HUT kantor" />
              <ComboboxField
                label="Jenis"
                name="kind"
                defaultValue="OFFICE"
                options={(Object.keys(kindLabel) as HolidayKind[]).map((k) => ({ value: k, label: kindLabel[k].label }))}
              />
            </ActionForm>
          </Card>
        </div>

        <Card className="min-w-0">
          <CardTitle
            title={`Daftar libur ${year}`}
            hint={`${holidays.length} hari`}
            action={
              <nav aria-label="Tahun" className="flex flex-wrap gap-1.5">
                {yearOptions.map((y) => (
                  <Link
                    key={y}
                    href={`/admin/libur?year=${y}`}
                    aria-current={y === year ? "page" : undefined}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-sm font-semibold",
                      y === year ? "bg-ink text-white" : "bg-canvas text-muted hover:text-ink",
                    )}
                  >
                    {y}
                  </Link>
                ))}
              </nav>
            }
          />
          {holidays.length === 0 ? (
            <EmptyState
              title={`Belum ada libur untuk ${year}`}
              description="Tambahkan libur nasional dan cuti bersama sesuai SKB yang berlaku."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Keterangan</Th>
                  <Th>Jenis</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <Td className="whitespace-nowrap">
                      <span className="block font-semibold">{formatDate(h.date, "long")}</span>
                      <span className="text-xs text-muted">{formatWeekday(h.date)}</span>
                    </Td>
                    <Td>{h.name}</Td>
                    <Td>
                      <Badge tone={kindLabel[h.kind].tone}>{kindLabel[h.kind].label}</Badge>
                    </Td>
                    <Td className="text-right">
                      <ActionButton
                        action={deleteHoliday.bind(null, h.id)}
                        variant="danger"
                        confirmText={`Hapus libur ${formatDate(h.date)}?`}
                        className="px-3 py-1.5 text-xs"
                      >
                        Hapus
                      </ActionButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
