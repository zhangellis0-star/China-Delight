"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const seenKey = "china-delight-cash-discount-popup-seen";

export function CashDiscountPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const excluded = !pathname || pathname.startsWith("/admin") || pathname.startsWith("/checkout") || pathname.startsWith("/order-status");

  useEffect(() => {
    if (excluded) return;
    if (window.sessionStorage.getItem(seenKey)) return;
    window.sessionStorage.setItem(seenKey, "1");
    setOpen(true);
  }, [excluded]);

  if (excluded || !open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cash-discount-popup-title">
      <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0" />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-china-gold/60 bg-white p-5 text-center shadow-warm sm:p-6">
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="focus-ring absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="cash-discount-popup-title" className="mt-2 text-2xl font-black text-china-red">
          5% Cash Discount
        </h2>
        <p className="mt-2 text-base font-bold text-stone-700">Cash Price is 5% lower than Card Price.</p>
        <Link
          href="/order"
          onClick={() => setOpen(false)}
          className="focus-ring mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-china-red px-5 py-3 text-base font-black text-white shadow-warm hover:bg-red-700"
        >
          Start Order
        </Link>
      </div>
    </div>
  );
}
