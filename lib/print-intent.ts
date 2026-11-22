// The tablet app asks the server for a ticket by order number only, and numbers repeat across
// days. Just before the tablet is asked to print, the admin page stores the exact order's id in
// this short-lived cookie; the tablet's ticket request carries the page's cookies, so the server
// can print exactly that order. The tablet app itself needs no change.
export const printIntentCookie = "cd_print_order";
const printIntentSeconds = 120;

export function rememberOrderToPrint(orderId: string | null | undefined) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = orderId
    ? `${printIntentCookie}=${encodeURIComponent(orderId)}; Path=/; Max-Age=${printIntentSeconds}; SameSite=Strict${secure}`
    : `${printIntentCookie}=; Path=/; Max-Age=0; SameSite=Strict${secure}`;
}
