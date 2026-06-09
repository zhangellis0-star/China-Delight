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
  // Admin-only: an optional per-unit extra charge added when editing/adding an item in the dashboard.
  // The order_items.unit_price stored already includes this amount; these fields are kept for display.
  extraChargeLabel?: string;
  extraChargeAmount?: number;
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
  discount: number;
  tax: number;
  processingFee: number;
  tip: number;
  total: number;
  promoCode?: string | null;
};

// "percentage": value is a percent (10 = 10% off). "fixed"/"credit": value is dollars (5 = $5.00 off).
export type PromoDiscountType = "percentage" | "fixed" | "credit";

export type PromoCode = {
  id: string;
  code: string;
  description?: string | null;
  discount_type: PromoDiscountType;
  discount_value: number;
  minimum_subtotal?: number | null;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

// What the checkout UI keeps after a code is applied (no admin-only fields like used_count/max_uses).
export type AppliedPromo = {
  code: string;
  description?: string | null;
  discountType: PromoDiscountType;
  discountValue: number;
  discountAmount: number;
};

export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "picked_up" | "completed" | "cancelled";
export type PaymentMethod = "stripe" | "pay_at_pickup";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";
export type PickupTimeType = "asap" | "scheduled";

export type CheckoutCustomer = {
  name: string;
  phone: string;
  email: string;
  fulfillment: "pickup";
  address?: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  pickupTimeType: PickupTimeType;
  scheduledPickupTime?: string;
};
