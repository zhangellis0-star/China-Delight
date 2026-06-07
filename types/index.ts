export type MenuCategory =
  | "Appetizers"
  | "Soup"
  | "Fried Rice"
  | "Lo Mein"
  | "Chow Mein"
  | "Combination Platter"
  | "Chicken"
  | "Roast Pork"
  | "Beef"
  | "Seafood"
  | "Sweet & Sour"
  | "Egg Foo Young"
  | "Vegetable"
  | "Chow Fun/Mai Fun"
  | "Wings"
  | "Szechuan & Hunan Dishes"
  | "Special Combination Platters"
  | "Chef Specials"
  | "Diet Food / Steamed"
  | "Lunch Special"
  | "Side Orders";

export type MenuPriceKey = "pint" | "quart" | "combo" | "order" | "large" | "small";
export type MenuPrice = number | "NEEDS_REVIEW";

export type MenuItem = {
  id: string;
  number: string;
  name: string;
  chineseName?: string;
  category: MenuCategory;
  description?: string;
  spicy?: boolean;
  prices: Partial<Record<MenuPriceKey, MenuPrice>>;
  reviewNote?: string;
  options?: {
    spiceLevel?: boolean;
    rice?: boolean;
    size?: MenuPriceKey[];
    addOns?: boolean;
    lunchChoices?: boolean;
    comboIncluded?: boolean;
  };
};

export type LunchRiceChoice = "Pork Fried Rice" | "White Rice";
export type LunchSideChoice = "Egg Roll" | "Wonton Soup" | "Egg Drop Soup" | "Canned Soda";

export type CartCustomization = {
  size: MenuPriceKey;
  spiceLevel?: "None" | "Mild" | "Medium" | "Hot" | "Extra Hot";
  rice?: "White Rice" | "Fried Rice" | "Pork Fried Rice" | "No Rice";
  lunchRice?: LunchRiceChoice;
  lunchSide?: LunchSideChoice;
  includedItems?: string[];
  addOns?: string[];
  sauceOnSide?: boolean;
  noOnion?: boolean;
  noBroccoli?: boolean;
  notes?: string;
};

export type CartItem = {
  cartId: string;
  menuItemId: string;
  number: string;
  name: string;
  category: MenuCategory;
  quantity: number;
  unitPrice: number;
  customization: CartCustomization;
};

export type CartTotals = {
  subtotal: number;
  tax: number;
  processingFee: number;
  tip: number;
  total: number;
};

export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
export type PaymentMethod = "stripe" | "pay_at_pickup";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";
export type PickupTimeType = "asap" | "scheduled";

export type CheckoutCustomer = {
  name: string;
  phone: string;
  email?: string;
  fulfillment: "pickup";
  address?: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  pickupTimeType: PickupTimeType;
  scheduledPickupTime?: string;
};
