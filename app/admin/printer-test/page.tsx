import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PrinterEndpointTest } from "@/components/orders/printer-endpoint-test";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";

export default function AdminPrinterTestPage() {
  const session = cookies().get(getAdminCookieName())?.value;
  if (!isValidAdminSession(session)) redirect("/admin/login");
  return <PrinterEndpointTest />;
}
