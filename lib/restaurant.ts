// Edit this file when restaurant information, hours, tax rate, or contact details change.
export const restaurant = {
  name: "China Delight",
  type: "Chinese Restaurant - Take Out & Dine In",
  phone: "(860) 379-3467",
  phoneHref: "tel:+18603793467",
  address: "200 New Hartford Rd, Winsted, CT 06098",
  locationNote: "Rt 44, Ledgbrook Plaza, next to Super Stop & Shop",
  mapQuery: "200 New Hartford Rd, Winsted, CT 06098",
  hours: [
    { days: "Monday - Thursday", time: "11:00 AM - 10:00 PM" },
    { days: "Friday & Saturday", time: "11:00 AM - 10:30 PM" },
    { days: "Sunday", time: "12:00 noon - 10:00 PM" }
  ],
  taxRate: Number(process.env.NEXT_PUBLIC_TAX_RATE ?? "0.0635"),
  featuredDishIds: ["general-tsos-chicken", "fried-dumplings", "happy-family", "sesame-chicken"]
};

export const addonPrices = {
  "Extra sauce": 1,
  "Extra meat": 3,
  "Extra vegetables": 2,
  "Extra rice": 2
};

export const freeCustomizationOptions = ["Sauce on side", "No onion", "No broccoli"] as const;
