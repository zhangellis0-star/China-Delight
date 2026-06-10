import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";

// Debug/diagnostic routes are open in local development but require a logged-in
// admin session in production. Callers should return a 404 (not 401) on failure
// so the routes are not discoverable.
export function isDebugRouteAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}
