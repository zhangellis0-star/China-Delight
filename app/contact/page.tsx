import { MapPin, Phone } from "lucide-react";
import { DeliveryPlatforms } from "@/components/delivery-platforms";
import { restaurant } from "@/lib/restaurant";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(restaurant.mapQuery)}&output=embed`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <h1 className="text-3xl font-black leading-tight sm:text-4xl">Contact and location</h1>
      <div className="mt-6 grid gap-5 sm:mt-8 lg:grid-cols-[420px_1fr] lg:gap-6">
        <div className="grid gap-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <p className="font-black uppercase tracking-[0.16em] text-china-red">China Delight</p>
            <p className="mt-2 text-xl font-black sm:text-2xl">{restaurant.address}</p>
            <p className="mt-2 text-stone-600">{restaurant.locationNote}</p>
          </div>
          <a href={restaurant.phoneHref} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-china-red px-5 py-3 font-black text-white">
            <Phone className="h-5 w-5" />
            {restaurant.phone}
          </a>
          <div className="grid gap-2">
            {restaurant.hours.map((row) => (
              <div key={row.days} className="flex flex-wrap justify-between gap-2 rounded-md border border-stone-200 p-3">
                <span className="font-bold">{row.days}</span>
                <span>{row.time}</span>
              </div>
            ))}
          </div>
          <p className="inline-flex items-center gap-2 text-stone-700">
            <MapPin className="h-5 w-5 text-china-red" />
            Rt 44, Ledgbrook Plaza
          </p>
        </div>
        <iframe title="China Delight map" src={mapSrc} className="h-[320px] w-full rounded-lg border border-stone-200 bg-white sm:h-[420px] lg:min-h-[520px]" loading="lazy" />
      </div>
      <div className="mt-8">
        <DeliveryPlatforms compact />
      </div>
    </section>
  );
}
