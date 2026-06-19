"use client";

import { usePathname } from "next/navigation";
import { restaurant } from "@/lib/restaurant";

export function SiteFooter() {
  const pathname = usePathname();
  // The admin dashboard has its own full-screen chrome; the public marketing footer
  // would otherwise add a large dark block (and blank space) below it.
  if (pathname?.startsWith("/admin")) return null;
  return (
    <footer className="border-t border-red-900/10 bg-china-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="text-xl font-black text-china-gold">{restaurant.name}</p>
          <p className="mt-2 text-sm text-stone-300">{restaurant.type}</p>
        </div>
        <div>
          <p className="font-bold">Visit</p>
          <p className="mt-2 text-sm text-stone-300">{restaurant.address}</p>
          <p className="text-sm text-stone-300">{restaurant.locationNote}</p>
        </div>
        <div>
          <p className="font-bold">Call</p>
          <a href={restaurant.phoneHref} className="mt-2 block text-lg font-black text-china-gold">
            {restaurant.phone}
          </a>
        </div>
      </div>
    </footer>
  );
}
