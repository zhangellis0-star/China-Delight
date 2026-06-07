import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PrintTicket } from "@/components/orders/print-ticket";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";

export default function PrintTicketPage({ params }: { params: { orderNumber: string } }) {
  const session = cookies().get(getAdminCookieName())?.value;
  if (!isValidAdminSession(session)) redirect("/admin/login");
  return <PrintTicket orderNumber={params.orderNumber} />;
}
