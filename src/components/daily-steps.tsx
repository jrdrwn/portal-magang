import { Coffee, Moon } from "lucide-react";
import { requireIntern } from "@/lib/auth";
import { getDailyPlan } from "@/lib/daily";
import { StepsNote, StepsStrip } from "./steps-strip";

export { DailyStepsSkeleton } from "./steps-strip";

/** Strip "Langkah hari ini" di atas setiap halaman peserta. */
export async function DailySteps() {
  const user = await requireIntern();
  const plan = await getDailyPlan(user.id);
  if (plan.kind === "none") return null;
  if (plan.kind === "off") {
    return <StepsNote icon={<Moon className="size-5" aria-hidden />}>{plan.reason} Tidak ada absen hari ini.</StepsNote>;
  }
  if (plan.kind === "absent") {
    return (
      <StepsNote icon={<Coffee className="size-5" aria-hidden />}>
        {plan.label} tercatat. Tidak perlu absen atau mencatat aktivitas hari ini.
      </StepsNote>
    );
  }
  return <StepsStrip steps={plan.steps} next={plan.next} doneText="Semua selesai. Sampai jumpa besok!" />;
}
