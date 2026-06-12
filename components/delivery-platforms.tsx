import { ExternalLink } from "lucide-react";
import { restaurant } from "@/lib/restaurant";

export function DeliveryPlatforms({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`${compact ? "" : "mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8"}`}>
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="font-black uppercase tracking-[0.16em] text-china-red">Delivery</p>
        <h2 className="mt-2 text-xl font-black leading-tight text-china-ink sm:text-2xl">Delivery is available through DoorDash, Uber Eats, and Grubhub.</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700 sm:text-base sm:leading-7">Online orders through this website are pickup only.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {restaurant.deliveryPlatforms.map((platform) =>
            platform.url ? (
              <a
                key={platform.name}
                href={platform.url}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-china-red px-4 py-3 text-center font-black text-white"
              >
                {platform.name}
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <span key={platform.name} className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-md border border-stone-300 bg-stone-100 px-4 py-3 text-center font-black text-stone-500">
                {platform.name} - Coming soon
              </span>
            )
          )}
        </div>
      </div>
    </section>
  );
}
