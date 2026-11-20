// CSV untuk Excel (lokal Indonesia memakai pemisah ";"), dengan BOM agar UTF-8 terbaca.

const SEP = ";";

function cell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Cegah formula injection saat dibuka di spreadsheet.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]) {
  const lines = [header, ...rows].map((r) => r.map(cell).join(SEP));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
