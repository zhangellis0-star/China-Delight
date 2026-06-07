import Link from "next/link";
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
      <section className="bg-[radial-gradient(circle_at_top_left,#f6c453_0,#f6c453_20%,transparent_21%),linear-gradient(135deg,#7f1d1d,#b91c1c_52%,#1f1712)] text-white">
        <div className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-china-gold">{restaurant.type}</p>
            <h1 className="mt-4 text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">{restaurant.name}</h1>
            <p className="mt-5 max-w-xl text-xl leading-8 text-red-50">
              Fresh Chinese favorites for pickup, take out, and dine in at Ledgbrook Plaza in Winsted.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/order" className="min-h-16 px-8 text-xl bg-china-gold text-china-ink shadow-warm">
                Start Your Order
              </ButtonLink>
              <ButtonLink href="/menu" className="border border-white bg-white/10 text-white">
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

          <div className="rounded-lg border border-white/25 bg-white p-5 text-china-ink shadow-warm">
            <div className="aspect-[4/3] rounded-md bg-[linear-gradient(135deg,#fff7db,#ffffff_40%,#fee2e2)] p-6">
              <div className="flex h-full flex-col justify-between rounded-md border-4 border-double border-china-red bg-white/75 p-5">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-china-red">Welcome, Party Order</p>
                  <h2 className="mt-3 text-4xl font-black text-china-deep">Hot Chinese Food</h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {["Dumplings", "General Tso's", "Lo Mein"].map((name) => (
                    <div key={name} className="rounded-md bg-china-red px-3 py-4 text-center text-sm font-black text-white">
                      {name}
                    </div>
                  ))}
                </div>
                <p className="font-bold text-stone-700">{restaurant.locationNote}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DeliveryPlatforms />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-black uppercase tracking-[0.16em] text-china-red">Featured dishes</p>
            <h2 className="mt-2 text-3xl font-black text-china-ink">Customer favorites</h2>
          </div>
          <Link href="/order" className="font-black text-china-red hover:text-china-deep">
            Start an order
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featured.map((item) => item && <MenuItemCard key={item.id} item={item} />)}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="font-black uppercase tracking-[0.16em] text-china-red">Hours</p>
            <h2 className="mt-2 text-3xl font-black">Open seven days</h2>
            <div className="mt-6 grid gap-3">
              {restaurant.hours.map((row) => (
                <div key={row.days} className="flex items-center justify-between rounded-md border border-stone-200 p-4">
                  <span className="font-bold">{row.days}</span>
                  <span>{row.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-china-paper p-5">
            <div className="flex items-center gap-2 text-china-red">
              <Star className="h-5 w-5 fill-current" />
              <p className="font-black">Easy pickup ordering</p>
            </div>
            <p className="mt-3 text-lg leading-8 text-stone-700">Order online for pickup, review your total, pay securely, and receive an order number.</p>
            <div className="mt-5 rounded-md border border-stone-300 bg-white p-4">
              <p className="font-black">{restaurant.address}</p>
              <p className="mt-1 text-stone-600">{restaurant.locationNote}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
