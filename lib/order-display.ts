import { comboIncludedItems } from "@/lib/order-rules";
import type { CartCustomization } from "@/types";

export function customizationParts(customization?: Partial<CartCustomization> | Record<string, unknown>) {
  if (!customization) return [];
  const includedItems = Array.isArray(customization.includedItems) ? customization.includedItems : [];
  const addOns = Array.isArray(customization.addOns) ? customization.addOns : [];
  const extraChargeAmount = Number((customization as { extraChargeAmount?: unknown }).extraChargeAmount ?? 0);
  const extraChargeLabel = typeof customization.extraChargeLabel === "string" ? customization.extraChargeLabel : "";
  const isSpecialOffer = Boolean((customization as { specialOffer?: unknown }).specialOffer);

  return [
    isSpecialOffer ? "FREE (special offer)" : "",
    customization.size ? `Size: ${customization.size}` : "",
    customization.lunchRice ? `Lunch rice: ${customization.lunchRice}` : "",
    customization.lunchSide ? `Lunch side: ${customization.lunchSide}` : "",
    includedItems.length ? `Includes: ${includedItems.join(", ")}` : "",
    customization.rice ? `Rice: ${customization.rice}` : "",
    customization.spiceLevel ? `Spice: ${customization.spiceLevel}` : "",
    customization.sauceOnSide ? "Sauce on side" : "",
    customization.noOnion ? "No onion" : "",
    customization.noBroccoli ? "No broccoli" : "",
    addOns.length ? `Add-ons: ${addOns.join(", ")}` : "",
    extraChargeLabel || extraChargeAmount > 0 ? `${extraChargeLabel || "Extra charge"} (+$${extraChargeAmount.toFixed(2)})` : ""
  ].filter(Boolean) as string[];
}

export function customizationText(customization?: Partial<CartCustomization> | Record<string, unknown>) {
  return customizationParts(customization).join(" | ");
}

export function ensureComboIncluded(customization: CartCustomization) {
  return { ...customization, includedItems: customization.includedItems?.length ? customization.includedItems : comboIncludedItems };
}
