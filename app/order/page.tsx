import { MenuBrowser } from "@/components/menu/menu-browser";

export default function OrderPage() {
  return (
    <>
      <section className="bg-china-red px-4 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="font-black uppercase tracking-[0.16em] text-china-gold">Order online</p>
          <h1 className="mt-2 text-4xl font-black">Choose dishes, customize, then checkout</h1>
        </div>
      </section>
      <MenuBrowser orderMode />
    </>
  );
}
