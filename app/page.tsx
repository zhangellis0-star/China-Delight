import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Star } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { DeliveryPlatforms } from "@/components/delivery-platforms";
import { MenuItemCard } from "@/components/menu/menu-item-card";
import { menuItems } from "@/data/menu";
import { restaurant } from "@/lib/restaurant";

export default function HomePage() {
  const featured = restaurant.featuredDishIds.map((id) => menuItems.find((item) => item.id === id)).filter(Boolean).slice(0, 4);

  return (
    <>
      <section className="bg-[radial-gradient(circle_at_top_left,#f5b642_0%,#f5b642_10%,transparent_22%),linear-gradient(135deg,#0f5f56_0%,#2f8d7c_46%,#dff4f2_100%)] text-white">
        <div className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
          <div>
            <p className="inline-flex rounded-full border border-china-gold/40 bg-white/10 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-china-gold">
              {restaurant.type}
            </p>
            <h1 className="mt-4 text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">{restaurant.name}</h1>
            <p className="mt-5 max-w-xl text-xl leading-8 text-teal-50">
              Fresh Chinese favorites for pickup, take out, and dine in at Ledgbrook Plaza in Winsted.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/order" className="min-h-16 px-8 text-xl bg-china-gold text-china-ink shadow-warm hover:bg-yellow-300">
                Start Your Order
              </ButtonLink>
              <ButtonLink href="/menu" className="border border-white/80 bg-white/15 text-white hover:bg-white/25">
                View Full Menu
              </ButtonLink>
            </div>
            <p className="mt-3 text-lg font-black text-china-gold">Click Start Your Order to begin a pickup order now.</p>
            <div className="mt-8 grid gap-3 text-lg font-bold">
              <a href={restaurant.phoneHref} className="inline-flex items-center gap-3">
                <Phone className="h-6 w-6 text-china-gold" />
                {restaurant.phone}
              </a>
              <p className="inline-flex items-center gap-3">
                <MapPin className="h-6 w-6 text-china-gold" />
                {restaurant.address}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/35 bg-[#f5fbf5] p-4 text-china-ink shadow-warm sm:p-5">
            <div className="rounded-md border border-china-green/50 bg-[linear-gradient(180deg,#dff4f2_0%,#fffaf0_100%)] p-4 sm:p-6">
              <div className="rounded-md border-4 border-double border-teal-700 bg-white/90 p-4 text-center sm:p-5">
                <div className="mx-auto max-w-md overflow-hidden rounded-md bg-[#e2f4ef] p-2 ring-2 ring-china-green/35">
                  <Image
                    src="/brand/china-delight-logo-art.png"
                    alt="China Delight restaurant logo art"
                    width={900}
                    height={620}
                    className="h-auto max-h-72 w-full object-contain"
                    priority
                  />
                </div>
                <h2 className="mt-5 text-3xl font-black text-teal-900 sm:text-4xl">Hot Chinese Food</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm font-bold leading-6 text-stone-700">{restaurant.locationNote}</p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {["Dumplings", "General Tso's", "Lo Mein"].map((name) => (
                    <div key={name} className="rounded-md bg-teal-800 px-2 py-3 text-center text-xs font-black text-white sm:text-sm">
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-[#f5fbf5]">
        <DeliveryPlatforms />
      </div>

      <section className="bg-[#f5fbf5]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 rounded-lg border border-china-green/35 bg-white/70 p-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-black uppercase tracking-[0.16em] text-china-red">Featured dishes</p>
            <h2 className="mt-2 text-3xl font-black text-china-ink">Customer favorites</h2>
          </div>
          <Link href="/order" className="rounded-md bg-teal-800 px-4 py-3 text-center font-black text-white shadow-sm hover:bg-teal-900">
            Start an order
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featured.map((item) => item && <MenuItemCard key={item.id} item={item} />)}
        </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f5fbf5,#dff4f2)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="font-black uppercase tracking-[0.16em] text-china-red">Hours</p>
            <h2 className="mt-2 text-3xl font-black">Open seven days</h2>
            <div className="mt-6 grid gap-3">
              {restaurant.hours.map((row) => (
                <div key={row.days} className="flex items-center justify-between rounded-md border border-china-green/35 bg-white/85 p-4">
                  <span className="font-bold">{row.days}</span>
                  <span>{row.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-china-green/40 bg-[#fffaf0] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-teal-800">
              <Star className="h-5 w-5 fill-current" />
              <p className="font-black">Easy pickup ordering</p>
            </div>
            <p className="mt-3 text-lg leading-8 text-stone-700">Order online for pickup, review your total, pay in store, and receive an order number.</p>
            <div className="mt-5 rounded-md border border-china-green/35 bg-white p-4">
              <p className="font-black">{restaurant.address}</p>
              <p className="mt-1 text-stone-600">{restaurant.locationNote}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
