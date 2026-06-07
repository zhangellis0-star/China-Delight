import { DeliveryPlatforms } from "@/components/delivery-platforms";
import { MenuBrowser } from "@/components/menu/menu-browser";

export default function OrderPage() {
  return (
    <>
      <section className="bg-china-red px-4 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="font-black uppercase tracking-[0.16em] text-china-gold">Order online</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Choose dishes, customize, then checkout</h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-red-50">Online ordering on this site is pickup only.</p>
        </div>
      </section>
      <DeliveryPlatforms />
      <MenuBrowser orderMode />
    </>
  );
}
