"use client";

import { useState } from "react";
import { ChoiceGroup, Field } from "./ui/form";
import { internshipTypeInfo } from "@/lib/labels";

export function RegistrationFields({
  teams,
  today,
}: {
  teams: { id: string; name: string; description: string | null }[];
  today: string;
}) {
  const [type, setType] = useState<"MANDIRI" | "MAGANGHUB">("MANDIRI");
  const thisYear = Number(today.slice(0, 4));

  return (
    <>
      <ChoiceGroup
        label="Jenis magang"
        name="type"
        defaultValue="MANDIRI"
        onChange={(v) => setType(v as "MANDIRI" | "MAGANGHUB")}
        options={(["MANDIRI", "MAGANGHUB"] as const).map((t) => ({
          value: t,
          label: internshipTypeInfo[t].label,
          description: internshipTypeInfo[t].description,
        }))}
      />

      {type === "MAGANGHUB" ? (
        <Field
          label="Tahun lulus"
          name="graduationYear"
          type="number"
          inputMode="numeric"
          min={thisYear - 10}
          max={thisYear}
          placeholder={String(thisYear)}
          hint="MagangHub khusus untuk yang sudah lulus."
        />
      ) : null}

      <ChoiceGroup
        label="Tim"
        name="teamId"
        columns={teams.length > 2 ? 2 : 1}
        options={teams.map((t) => ({
          value: t.id,
          label: t.name,
          description: t.description,
        }))}
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
    </>
  );
}
