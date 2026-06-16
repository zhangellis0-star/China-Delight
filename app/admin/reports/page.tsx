import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReportsHistoryPage } from "@/components/orders/reports-history-page";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";

export default function AdminReportsPage() {
  const session = cookies().get(getAdminCookieName())?.value;
  if (!isValidAdminSession(session)) redirect("/admin/login");
  return <ReportsHistoryPage />;
}
