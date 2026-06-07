import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/orders/admin-dashboard";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";

export default function AdminPage() {
  const session = cookies().get(getAdminCookieName())?.value;
  if (!isValidAdminSession(session)) redirect("/admin/login");
  return <AdminDashboard />;
}
