import { MenuBrowser } from "@/components/menu/menu-browser";

export const dynamic = "force-dynamic";

export default function MenuPage() {
  return (
    <>
      <section className="bg-china-deep px-4 py-8 text-white sm:py-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-black uppercase tracking-[0.16em] text-china-gold">Full menu</p>
          <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">Search every dish by name or number</h1>
        </div>
      </section>
      <MenuBrowser />
    </>
  );
}
