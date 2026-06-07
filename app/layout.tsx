import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/cart-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { restaurant } from "@/lib/restaurant";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${restaurant.name} | Online Ordering`,
  description: `${restaurant.name} Chinese Restaurant in Winsted, CT. Take out, dine in, and pickup ordering. Delivery is available through third-party platforms.`
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CartProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
