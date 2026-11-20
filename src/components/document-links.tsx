import { FileText } from "lucide-react";

const LABEL = { CV: "CV", COVER_LETTER: "Surat pengantar" } as const;

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function DocumentLinks({
  docs,
}: {
  docs: { id: string; kind: keyof typeof LABEL; fileName: string; size: number }[];
}) {
  if (docs.length === 0) return <p className="text-xs text-muted">Tidak ada dokumen.</p>;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Dokumen pendaftaran">
      {docs.map((d) => (
        <li key={d.id}>
          <a
            href={`/api/berkas/dokumen/${d.id}`}
            target="_blank"
            rel="noreferrer"
            title={d.fileName}
            className="inline-flex max-w-64 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-line hover:ring-brand-200"
          >
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{LABEL[d.kind]}</span>
            <span className="shrink-0 font-normal text-muted">{size(d.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
