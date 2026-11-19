import { getCurrentUser } from "@/lib/auth";
import { ensureSurveyReminders, getNotifications } from "@/lib/notifications";

/** Dipakai ikon lonceng (polling). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Tidak masuk" }, { status: 401 });
  if (user.role === "INTERN") await ensureSurveyReminders(user.id);
  const data = await getNotifications(user.id, 8);
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
