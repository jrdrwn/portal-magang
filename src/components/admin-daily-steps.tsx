import { requireAdmin } from "@/lib/auth";
import { getAdminPlan } from "@/lib/admin-daily";
import { StepsStrip } from "./steps-strip";

/** Strip "Langkah hari ini" untuk admin (data timnya; admin utama: semua tim). */
export async function AdminDailySteps() {
  const admin = await requireAdmin();
  const plan = await getAdminPlan(admin);
  return <StepsStrip steps={plan.steps} next={plan.next} doneText="Semua beres untuk hari ini." />;
}
