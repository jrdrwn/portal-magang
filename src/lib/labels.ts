import type {
  ActivityType,
  AttendanceStatus,
  RegistrationStatus,
} from "@/generated/prisma/enums";

export type Tone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

export const attendanceLabel: Record<
  AttendanceStatus,
  { label: string; tone: Tone }
> = {
  PRESENT: { label: "Hadir", tone: "success" },
  LATE: { label: "Terlambat", tone: "warning" },
  PERMIT: { label: "Izin", tone: "info" },
  SICK: { label: "Sakit", tone: "info" },
};

export const registrationLabel: Record<
  RegistrationStatus,
  { label: string; tone: Tone }
> = {
  PENDING: { label: "Menunggu", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
};

export const activityLabel: Record<ActivityType, { label: string; tone: Tone }> =
  {
    WORK: { label: "Bekerja", tone: "brand" },
    NOT_WORK: { label: "Tidak bekerja", tone: "neutral" },
  };

export const internshipTypeInfo: Record<
  "MANDIRI" | "MAGANGHUB",
  { label: string; description: string; tone: Tone }
> = {
  MANDIRI: {
    label: "Mandiri",
    description: "Pelajar atau mahasiswa yang magang atas pengajuan sendiri/kampus.",
    tone: "brand",
  },
  MAGANGHUB: {
    label: "MagangHub",
    description: "Peserta program MagangHub, khusus yang sudah lulus.",
    tone: "info",
  },
};

export const roleLabel: Record<"SUPER_ADMIN" | "TEAM_ADMIN" | "INTERN", string> = {
  SUPER_ADMIN: "Admin utama",
  TEAM_ADMIN: "Admin tim",
  INTERN: "Peserta",
};
