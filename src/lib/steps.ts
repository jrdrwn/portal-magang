export type StepState = "done" | "current" | "upcoming" | "late" | "skipped";

export type StripStep = {
  key: string;
  label: string;
  state: StepState;
  /** Keterangan singkat, mis. "07:55" atau "3 menunggu". */
  detail: string;
};

export type NextStep = { label: string; href: string; hint: string };

export const clock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
