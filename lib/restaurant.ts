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
  taxRate: Number(process.env.NEXT_PUBLIC_TAX_RATE ?? "0.0735"),
  processingFeeRate: Number(process.env.NEXT_PUBLIC_PROCESSING_FEE_RATE ?? "0.06"),
  featuredDishIds: ["general-tsos-chicken", "fried-dumplings", "happy-family", "sesame-chicken"],
  // Add the real restaurant marketplace URLs here when they are ready.
  deliveryPlatforms: [
  {
    name: "DoorDash",
    url: "https://www.doordash.com/store/china-delight-winsted-43169681/107251955/?event_type=autocomplete&pickup=false"
  },
  {
    name: "Uber Eats",
    url: "https://www.ubereats.com/store/china-delights/nNb5tlxiQcCWRqtQXJXaIw?diningMode=DELIVERY"
  },
  {
    name: "Grubhub",
    url: "https://www.grubhub.com/restaurant/china-delight-200-new-hartford-rd-16-winsted/5942784"
  }
]
};

export const addonPrices = {
  "Extra sauce": 1,
  "Extra meat": 3,
  "Extra vegetables": 2,
  "Extra rice": 2
};

export const freeCustomizationOptions = ["Sauce on side", "No onion", "No broccoli"] as const;
