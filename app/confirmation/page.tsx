import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { restaurant } from "@/lib/restaurant";
import { ConfirmationNumber } from "@/components/orders/confirmation-number";

export default function ConfirmationPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 sm:py-16 lg:px-8">
      <CheckCircle2 className="mx-auto h-14 w-14 text-green-600 sm:h-16 sm:w-16" />
      <h1 className="mt-5 text-3xl font-black sm:text-4xl">Order received</h1>
      <p className="mt-3 text-base text-stone-700 sm:text-xl">Your order number is:</p>
      <Suspense fallback={<p className="mt-3 break-words rounded-lg bg-white p-5 text-3xl font-black text-china-red shadow-warm sm:text-4xl">Loading...</p>}>
        <ConfirmationNumber />
      </Suspense>
      <p className="mt-6 text-base leading-7 text-stone-700 sm:text-lg sm:leading-8">
        Please call {restaurant.phone} if you need to change anything. Save this order number for pickup questions.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/order" className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md bg-china-red px-5 py-3 font-black text-white">
          Place another order
        </Link>
        <Link href="/" className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-stone-300 bg-white px-5 py-3 font-black text-stone-800">
          Back home
        </Link>
      </div>
    </section>
  );
}
