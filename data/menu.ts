import type { MenuCategory, MenuItem } from "@/types";

export const menuCategories: MenuCategory[] = [
  "Appetizers",
  "Soup",
  "Fried Rice",
  "Lo Mein",
  "Chow Mein",
  "Combination Platter",
  "Chicken",
  "Roast Pork",
  "Beef",
  "Seafood",
  "Sweet & Sour",
  "Egg Foo Young",
  "Vegetable",
  "Chow Fun/Mai Fun",
  "Wings",
  "Szechuan & Hunan Dishes",
  "Special Combination Platters",
  "Chef Specials",
  "Diet Food / Steamed",
  "Lunch Special",
  "Side Orders"
];

const regularOptions = { spiceLevel: true, rice: false, addOns: true };
const riceOptions = { spiceLevel: true, rice: true, addOns: true };
const comboOptions = { spiceLevel: true, comboIncluded: true, size: ["combo" as const] };
const lunchOptions = { spiceLevel: true, lunchChoices: true };

// Edit this seed file to replace placeholder entries or paste the full real menu.
// Prices come from the supplied China Delight photos where readable.
// Chinese names appear in the photos but are too small/blurry to transcribe reliably here.
// Add chineseName to each item after checking the physical menu or a clearer scan.
export const menuDataReviewNotes = [
  "Chinese names need manual entry from the printed menu or a clearer scan.",
  "Item numbers/prices marked NEEDS_REVIEW should be checked against the paper menu before accepting live orders.",
  "Review Appetizers around printed numbers 12-15 against the physical menu; the photo is readable enough for the current seed but still slightly angled.",
  "Review any hidden fold items not visible in the photos, especially skipped printed numbers such as Chef Specials 141 and 157, Seafood 88, and Szechuan/Hunan 123 and 131."
];

const rawMenuItems: MenuItem[] = [
  { id: "egg-roll", number: "1", name: "Egg Roll or Vegetable Egg Roll", category: "Appetizers", prices: { order: 2.35 }, options: regularOptions },
  { id: "shrimp-roll", number: "2", name: "Shrimp Roll or Spring Roll", category: "Appetizers", prices: { order: 2.35 }, options: regularOptions },
  { id: "fantail-shrimp", number: "3", name: "Fantail Shrimp", category: "Appetizers", prices: { order: 2.35 }, options: regularOptions },
  { id: "fried-wonton", number: "4", name: "Fried Wonton (12)", category: "Appetizers", prices: { order: 6.95 }, options: regularOptions },
  { id: "crab-rangoon", number: "5", name: "Crab Rangoon (10) or Cheese Wonton", category: "Appetizers", prices: { order: 8.35 }, options: regularOptions },
  { id: "teriyaki-beef", number: "6", name: "Teriyaki Beef (2)", category: "Appetizers", prices: { order: 6.75 }, options: regularOptions },
  { id: "bar-b-q-spare-ribs", number: "7", name: "Bar-B-Q Spare Ribs", category: "Appetizers", prices: { small: 9.35, large: 18.95 }, options: regularOptions },
  { id: "boneless-spare-ribs", number: "8", name: "Boneless Spare Ribs", category: "Appetizers", prices: { small: 9.35, large: 18.95 }, options: regularOptions },
  { id: "golden-finger-chicken", number: "9", name: "Golden Finger Chicken", category: "Appetizers", prices: { order: 9.95 }, options: regularOptions },
  { id: "chicken-nugget", number: "10", name: "Chicken Nugget", category: "Appetizers", prices: { order: 6.85 }, options: regularOptions },
  { id: "fried-chicken-wings-app", number: "11", name: "Fried Chicken Wings", category: "Appetizers", prices: { order: 7.25 }, options: regularOptions },
  { id: "dumplings", number: "15", name: "Dumpling, Pan Fried or Steamed (8)", category: "Appetizers", prices: { order: 8.95 }, options: regularOptions },
  { id: "vegetable-dumplings", number: "15a", name: "Vegetable Dumpling, Pan Fried or Steamed (8)", category: "Appetizers", prices: { order: 8.95 }, options: regularOptions },
  { id: "pu-pu-platter", number: "16", name: "Pu Pu Platter", category: "Appetizers", prices: { order: 16.25 }, description: "Egg roll, crab rangoon, golden finger, fantail shrimp, fried wonton, chicken wing, teriyaki beef, fried wonton.", options: regularOptions },
  { id: "mini-pu-pu-platter", number: "16a", name: "Mini Pu Pu Platter", category: "Appetizers", prices: { order: 15.25 }, options: regularOptions },
  { id: "cold-sesame-noodles", number: "17", name: "Cold Sesame Noodles", category: "Appetizers", spicy: true, prices: { order: 8.50 }, options: regularOptions },
  { id: "steamed-wonton-sesame", number: "17a", name: "Steamed Wonton in Sesame Peanut Sauce", category: "Appetizers", prices: { order: 8.50 }, options: regularOptions },
  { id: "pan-fried-wonton-ginger", number: "18", name: "Pan Fried Wonton with Ginger Sauce", category: "Appetizers", prices: { order: 8.50 }, options: regularOptions },
  { id: "sugar-donut", number: "19", name: "Sugar Donut (10)", category: "Appetizers", prices: { order: 8.00 }, options: regularOptions },
  { id: "fried-shrimp-app", number: "19a", name: "Fried Shrimp", category: "Appetizers", prices: { order: 9.15 }, options: regularOptions },
  { id: "teriyaki-chicken", number: "20", name: "Teriyaki Chicken (3)", category: "Appetizers", prices: { order: 6.80 }, options: regularOptions },
  { id: "french-fries", number: "20b", name: "French Fries", category: "Appetizers", prices: { order: 7.10 }, options: regularOptions },

  { id: "wonton-soup", number: "21", name: "Wonton Soup", category: "Soup", description: "With fried noodles.", prices: { pint: 3.95, quart: 6.90 }, options: regularOptions },
  { id: "egg-drop-soup", number: "22", name: "Egg Drop Soup", category: "Soup", description: "With fried noodles.", prices: { pint: 3.95, quart: 6.90 }, options: regularOptions },
  { id: "chicken-noodle-soup", number: "23", name: "Chicken Noodle Soup", category: "Soup", description: "With fried noodles.", prices: { pint: 3.95, quart: 6.90 }, options: regularOptions },
  { id: "chicken-rice-soup", number: "24", name: "Chicken Rice Soup", category: "Soup", description: "With fried noodles.", prices: { pint: 3.95, quart: 6.90 }, options: regularOptions },
  { id: "wonton-egg-drop-mixed-soup", number: "25", name: "Wonton Egg Drop Mixed Soup", category: "Soup", description: "With fried noodles.", prices: { pint: 5.25, quart: 7.85 }, options: regularOptions },
  { id: "vegetable-soup", number: "26", name: "Vegetable Soup", category: "Soup", description: "With fried noodles.", prices: { pint: 5.25, quart: 6.90 }, options: regularOptions },
  { id: "hot-sour-soup", number: "27", name: "Hot & Sour Soup", category: "Soup", spicy: true, description: "With fried noodles.", prices: { pint: 5.75, quart: 7.95 }, options: regularOptions },
  { id: "house-special-soup", number: "28", name: "House Special Soup", category: "Soup", description: "With fried noodles.", prices: { quart: 7.95 }, options: regularOptions },
  { id: "chicken-vegetable-soup", number: "29", name: "Chicken with Vegetable Soup", category: "Soup", description: "With fried noodles.", prices: { quart: 7.95 }, options: regularOptions },
  { id: "bean-curd-subgum-wonton-soup", number: "30", name: "Bean Curd Subgum Wonton Soup", category: "Soup", description: "With fried noodles.", prices: { quart: 7.95 }, options: regularOptions },

  { id: "roast-pork-fried-rice", number: "31", name: "Roast Pork Fried Rice", category: "Fried Rice", prices: { pint: 6.50, quart: 9.95 }, options: regularOptions },
  { id: "chicken-fried-rice", number: "32", name: "Chicken Fried Rice", category: "Fried Rice", prices: { pint: 6.50, quart: 9.95 }, options: regularOptions },
  { id: "shrimp-fried-rice", number: "33", name: "Shrimp Fried Rice", category: "Fried Rice", prices: { pint: 6.50, quart: 10.95 }, options: regularOptions },
  { id: "beef-fried-rice", number: "34", name: "Beef Fried Rice", category: "Fried Rice", prices: { pint: 6.50, quart: 10.95 }, options: regularOptions },
  { id: "vegetable-fried-rice", number: "35", name: "Vegetable Fried Rice", category: "Fried Rice", prices: { pint: 6.50, quart: 9.95 }, options: regularOptions },
  { id: "house-special-fried-rice", number: "36", name: "House Special Fried Rice", category: "Fried Rice", prices: { pint: 6.50, quart: 10.95 }, options: regularOptions },
  { id: "plain-fried-rice", number: "37", name: "Plain Fried Rice", category: "Fried Rice", prices: { pint: 5.75, quart: 8.65 }, options: regularOptions },
  { id: "egg-fried-rice", number: "38", name: "Egg Fried Rice", category: "Fried Rice", prices: { pint: 6.50, quart: 10.95 }, options: regularOptions },

  { id: "roast-pork-lo-mein", number: "39", name: "Roast Pork Lo Mein", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.35, quart: 11.25, combo: 11.25 }, options: regularOptions },
  { id: "chicken-lo-mein", number: "40", name: "Chicken Lo Mein", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.35, quart: 11.25, combo: 11.25 }, options: regularOptions },
  { id: "shrimp-lo-mein", number: "41", name: "Shrimp Lo Mein", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.35, quart: 11.25, combo: 11.25 }, options: regularOptions },
  { id: "beef-lo-mein", number: "42", name: "Beef Lo Mein", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.35, quart: 11.25, combo: 11.25 }, options: regularOptions },
  { id: "vegetable-lo-mein", number: "43", name: "Vegetable Lo Mein", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.35, quart: 11.25, combo: 11.25 }, options: regularOptions },
  { id: "plain-lo-mein", number: "43a", name: "Plain Lo Mein", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.35, quart: 11.25 }, options: regularOptions },
  { id: "house-special-lo-mein", number: "44", name: "House Special Lo Mein", category: "Lo Mein", description: "Soft noodles.", prices: { order: 12.20 }, options: regularOptions },

  { id: "fresh-pork-chow-mein", number: "45", name: "Fresh Pork Chow Mein", category: "Chow Mein", description: "With white rice and fried noodles.", prices: { pint: 8.35, quart: 10.95, combo: 11.25 }, options: riceOptions },
  { id: "chicken-chow-mein", number: "46", name: "Chicken Chow Mein", category: "Chow Mein", description: "With white rice and fried noodles.", prices: { pint: 8.35, quart: 10.95, combo: 11.25 }, options: riceOptions },
  { id: "shrimp-chow-mein", number: "47", name: "Shrimp Chow Mein", category: "Chow Mein", description: "With white rice and fried noodles.", prices: { pint: 8.35, quart: 10.95, combo: 11.25 }, options: riceOptions },
  { id: "beef-chow-mein", number: "48", name: "Beef Chow Mein", category: "Chow Mein", description: "With white rice and fried noodles.", prices: { pint: 8.35, quart: 10.95, combo: 11.25 }, options: riceOptions },
  { id: "vegetable-chow-mein", number: "49", name: "Vegetable Chow Mein", category: "Chow Mein", description: "With white rice and fried noodles.", prices: { pint: 8.35, quart: 10.95, combo: 11.25 }, options: riceOptions },

  { id: "roast-pork-snow-peas", number: "58", name: "Roast Pork with Snow Peas", category: "Roast Pork", description: "With white rice.", prices: { pint: 8.95, quart: 13.60, combo: 11.95 }, options: riceOptions },
  { id: "roast-pork-chinese-vegetables", number: "59", name: "Roast Pork with Chinese Vegetables", category: "Roast Pork", description: "With white rice.", prices: { pint: 8.95, quart: 13.60, combo: 11.95 }, options: riceOptions },
  { id: "roast-pork-black-bean", number: "60", name: "Roast Pork with Black Bean Sauce", category: "Roast Pork", description: "With white rice.", prices: { pint: 8.95, quart: 13.60, combo: 11.95 }, options: riceOptions },
  { id: "roast-pork-broccoli", number: "61", name: "Roast Pork with Broccoli", category: "Roast Pork", description: "With white rice.", prices: { pint: 8.95, quart: 13.60, combo: 11.95 }, options: riceOptions },
  { id: "roast-pork-mixed-vegetables", number: "62", name: "Roast Pork with Mixed Vegetables", category: "Roast Pork", description: "With white rice.", prices: { pint: 8.95, quart: 13.60, combo: 11.95 }, options: riceOptions },

  { id: "beef-snow-peas", number: "63", name: "Beef with Snow Peas", category: "Beef", description: "With white rice.", prices: { pint: 8.95, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "beef-chinese-vegetables", number: "64", name: "Beef with Chinese Vegetables", category: "Beef", description: "With white rice.", prices: { pint: 8.95, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "beef-mushroom-oyster", number: "65", name: "Beef with Mushroom Oyster Sauce", category: "Beef", description: "With white rice.", prices: { pint: 8.95, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "beef-green-pepper-tomato", number: "66", name: "Beef with Green Pepper & Tomato", category: "Beef", description: "With white rice.", prices: { pint: 8.95, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "pepper-steak-onion", number: "67", name: "Pepper Steak with Onion", category: "Beef", description: "With white rice.", prices: { pint: 8.95, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "beef-broccoli", number: "68", name: "Beef with Broccoli", category: "Beef", description: "With white rice.", prices: { pint: 8.95, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "curry-beef-onion", number: "69", name: "Curry Beef with Onion", category: "Beef", spicy: true, description: "With white rice.", prices: { pint: 8.95, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "beef-mixed-vegetables", number: "69a", name: "Beef with Mixed Vegetables", category: "Beef", description: "With white rice.", prices: { pint: 8.95, quart: 13.95, combo: 11.95 }, options: riceOptions },

  { id: "chicken-snow-peas", number: "70", name: "Chicken with Snow Peas", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "moo-goo-gai-pan", number: "71", name: "Moo Goo Gai Pan", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "chicken-green-pepper-tomato", number: "72", name: "Chicken with Green Pepper & Tomato", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "chicken-mushroom-oyster", number: "73", name: "Chicken with Mushroom Oyster Sauce", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "chicken-black-bean", number: "74", name: "Chicken with Black Bean Sauce", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "chicken-cashew-nuts", number: "75", name: "Chicken with Cashew Nuts", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "chicken-mixed-vegetables", number: "76", name: "Chicken with Mixed Vegetables", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "chicken-broccoli", number: "77", name: "Chicken with Broccoli", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "curry-chicken-onion", number: "78", name: "Curry Chicken with Onion", category: "Chicken", spicy: true, description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },
  { id: "black-pepper-chicken", number: "78a", name: "Black Pepper Chicken", category: "Chicken", description: "With white rice.", prices: { pint: 8.95, quart: 13.85, combo: 11.95 }, options: riceOptions },

  { id: "shrimp-lobster-sauce", number: "79", name: "Shrimp with Lobster Sauce", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-snow-peas", number: "80", name: "Shrimp with Snow Peas", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-chinese-vegetables", number: "81", name: "Shrimp with Chinese Vegetables", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-green-pepper-tomato", number: "82", name: "Shrimp with Green Pepper & Tomato", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-black-bean", number: "83", name: "Shrimp with Black Bean Sauce", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-cashew-nuts", number: "84", name: "Shrimp with Cashew Nuts", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-broccoli", number: "85", name: "Shrimp with Broccoli", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-mixed-vegetables", number: "86", name: "Shrimp with Mixed Vegetables", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-lobster-sauce-alt", number: "87", name: "Shrimp with Lobster Sauce", category: "Seafood", description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },
  { id: "curry-shrimp-onion", number: "89", name: "Curry Shrimp with Onion", category: "Seafood", spicy: true, description: "With white rice.", prices: { pint: 9.35, quart: 13.95, combo: 11.95 }, options: riceOptions },

  { id: "sweet-sour-pork", number: "90", name: "Sweet & Sour Pork", category: "Sweet & Sour", description: "With white rice.", prices: { pint: 8.95, quart: 11.85, combo: 11.95 }, options: riceOptions },
  { id: "sweet-sour-chicken", number: "91", name: "Sweet & Sour Chicken", category: "Sweet & Sour", description: "With white rice.", prices: { pint: 8.95, quart: 11.85, combo: 11.95 }, options: riceOptions },
  { id: "sweet-sour-shrimp", number: "92", name: "Sweet & Sour Shrimp", category: "Sweet & Sour", description: "With white rice.", prices: { quart: 12.55, combo: 11.95 }, options: riceOptions },
  { id: "sweet-sour-triple", number: "93", name: "Sweet & Sour Triple", category: "Sweet & Sour", description: "Chicken, pork, shrimp. Per order.", prices: { order: 12.95 }, options: riceOptions },

  { id: "roast-pork-egg-foo-young", number: "94", name: "Roast Pork Egg Foo Young", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.35, combo: 11.35 }, options: riceOptions },
  { id: "chicken-egg-foo-young", number: "95", name: "Chicken Egg Foo Young", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.35, combo: 11.35 }, options: riceOptions },
  { id: "shrimp-egg-foo-young", number: "96", name: "Shrimp Egg Foo Young or Beef", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.35, combo: 11.35 }, options: riceOptions },
  { id: "mushroom-egg-foo-young", number: "97", name: "Mushroom Egg Foo Young", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.35, combo: 11.35 }, options: riceOptions },
  { id: "house-special-egg-foo-young", number: "97a", name: "House Special Egg Foo Young", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.35, combo: 11.35 }, options: riceOptions },
  { id: "vegetable-egg-foo-young", number: "98", name: "Vegetable Egg Foo Young", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.35, combo: 11.35 }, options: riceOptions },

  { id: "sauteed-broccoli", number: "99", name: "Sauteed Broccoli or Buddhist Delight", category: "Vegetable", description: "With white rice.", prices: { order: 11.95 }, options: riceOptions },
  { id: "tofu-broccoli", number: "99a", name: "Tofu with Broccoli", category: "Vegetable", description: "With white rice.", prices: { order: 11.95 }, options: riceOptions },
  { id: "mixed-chinese-vegetables", number: "100", name: "Mixed Chinese Vegetables", category: "Vegetable", description: "With white rice.", prices: { order: 11.95 }, options: riceOptions },
  { id: "eggplant-garlic-sauce", number: "100a", name: "Eggplant & Broccoli with Garlic Sauce", category: "Vegetable", spicy: true, description: "With white rice.", prices: { order: 11.95 }, options: riceOptions },
  { id: "tofu-mixed-vegetables", number: "101", name: "Tofu with Mixed Vegetables", category: "Vegetable", description: "With white rice.", prices: { order: 11.95 }, options: riceOptions },
  { id: "broccoli-garlic-sauce", number: "102", name: "Broccoli with Garlic Sauce", category: "Vegetable", spicy: true, description: "With white rice.", prices: { order: 11.95 }, options: riceOptions },
  { id: "bean-curd-home-style", number: "103", name: "Bean Curd Home Style", category: "Vegetable", description: "With white rice.", prices: { order: 11.95 }, options: riceOptions },
  { id: "string-beans-broccoli-garlic", number: "103a", name: "String Beans & Broccoli in Garlic Sauce", category: "Vegetable", spicy: true, description: "With white rice.", prices: { order: 11.95 }, options: riceOptions },

  { id: "chicken-chow-fun", number: "104", name: "Chicken Chow Fun or Mai Fun", category: "Chow Fun/Mai Fun", prices: { order: 11.95 }, options: regularOptions },
  { id: "pork-chow-fun", number: "105", name: "Pork Chow Fun or Mai Fun", category: "Chow Fun/Mai Fun", prices: { order: 11.95 }, options: regularOptions },
  { id: "shrimp-chow-fun", number: "106", name: "Shrimp Chow Fun or Mai Fun", category: "Chow Fun/Mai Fun", prices: { order: 12.20 }, options: regularOptions },
  { id: "singapore-chow-mai-fun", number: "107", name: "Singapore Chow Fun or Mai Fun", category: "Chow Fun/Mai Fun", spicy: true, prices: { order: 12.95 }, options: regularOptions },
  { id: "vegetable-chow-fun", number: "107a", name: "Vegetable Chow Fun or Mai Fun", category: "Chow Fun/Mai Fun", prices: { order: 11.95 }, options: regularOptions },
  { id: "house-special-chow-fun", number: "107b", name: "House Special Mai Fun", category: "Chow Fun/Mai Fun", prices: { order: 11.75 }, options: regularOptions },

  { id: "wings-french-fries", number: "108", name: "Chicken Wings with French Fries", category: "Wings", prices: { order: 11.75 }, options: regularOptions },
  { id: "wings-pork-fried-rice", number: "109", name: "Chicken Wings with Pork Fried Rice", category: "Wings", prices: { order: 11.75 }, options: regularOptions },
  { id: "wings-shrimp-fried-rice", number: "110", name: "Chicken Wings with Shrimp Fried Rice or Beef", category: "Wings", prices: { order: 11.75 }, options: regularOptions },
  { id: "wings-white-rice", number: "111", name: "Chicken Wings with White Rice", category: "Wings", prices: { order: 11.75 }, options: regularOptions },

  { id: "moo-shu-pork-chicken", number: "112", name: "Moo Shu Pork or Chicken", category: "Szechuan & Hunan Dishes", description: "With white rice except moo shu dishes.", prices: { order: 12.45 }, options: riceOptions },
  { id: "moo-shu-shrimp-beef", number: "113", name: "Moo Shu Shrimp or Beef", category: "Szechuan & Hunan Dishes", description: "With white rice except moo shu dishes.", prices: { order: 12.45 }, options: riceOptions },
  { id: "moo-shu-vegetable", number: "114", name: "Moo Shu Vegetable", category: "Szechuan & Hunan Dishes", description: "With white rice except moo shu dishes.", prices: { order: 12.45 }, options: riceOptions },
  { id: "chicken-string-bean", number: "115", name: "Chicken with String Bean", category: "Szechuan & Hunan Dishes", prices: { order: 12.45 }, options: riceOptions },
  { id: "shrimp-string-bean", number: "116", name: "Shrimp with String Bean", category: "Szechuan & Hunan Dishes", prices: { order: 12.45 }, options: riceOptions },
  { id: "sesame-chicken", number: "117", name: "Sesame Chicken", category: "Szechuan & Hunan Dishes", prices: { order: 13.85 }, options: riceOptions },
  { id: "sesame-beef", number: "118", name: "Sesame Beef", category: "Szechuan & Hunan Dishes", prices: { order: 14.20 }, options: riceOptions },
  { id: "sesame-shrimp", number: "119", name: "Sesame Shrimp", category: "Szechuan & Hunan Dishes", prices: { order: 14.45 }, options: riceOptions },
  { id: "beef-szechuan-style", number: "120", name: "Beef Szechuan Style", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.10 }, options: riceOptions },
  { id: "hunan-chicken", number: "121", name: "Hunan Chicken", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 12.90 }, options: riceOptions },
  { id: "hunan-beef", number: "122", name: "Hunan Beef", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.10 }, options: riceOptions },
  { id: "chicken-garlic-sauce", number: "124", name: "Chicken with Garlic Sauce", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 12.90 }, options: riceOptions },
  { id: "beef-garlic-sauce", number: "125", name: "Beef with Garlic Sauce", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 12.90 }, options: riceOptions },
  { id: "shrimp-garlic-sauce", number: "126", name: "Shrimp with Garlic Sauce", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 12.50 }, options: riceOptions },
  { id: "kung-po-chicken", number: "127", name: "Kung Po Chicken with Peanuts", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 12.90 }, options: riceOptions },
  { id: "kung-po-shrimp", number: "128", name: "Kung Po Shrimp with Peanuts", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 12.40 }, options: riceOptions },
  { id: "shrimp-chicken-garlic", number: "129", name: "Shrimp & Chicken in Garlic Sauce", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.85 }, options: riceOptions },
  { id: "general-tsos-tofu", number: "130", name: "General Tso's Tofu", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.85 }, options: riceOptions },
  { id: "shrimp-szechuan-style", number: "132", name: "Shrimp Szechuan Style", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.50 }, options: riceOptions },
  { id: "shrimp-chicken-hunan", number: "133", name: "Shrimp & Chicken Hunan Style", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.85 }, options: riceOptions },
  { id: "general-tsos-shrimp", number: "134", name: "General Tso's Shrimp", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 14.45 }, options: riceOptions },
  { id: "general-tsos-chicken", number: "135", name: "General Tso's Chicken", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.85 }, options: riceOptions },
  { id: "chicken-szechuan-style", number: "136", name: "Chicken Szechuan Style", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 12.90 }, options: riceOptions },
  { id: "general-tsos-double", number: "137", name: "General Tso's Double (Chicken & Shrimp)", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 14.05 }, options: riceOptions },

  { id: "combo-bbq-ribs", number: "C1", name: "Bar-B-Q Spare Ribs or Boneless", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 11.95 }, options: comboOptions },
  { id: "combo-boneless-chicken-finger", number: "C2", name: "Boneless & Chicken Finger", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.65 }, options: comboOptions },
  { id: "combo-sesame-chicken", number: "C3", name: "Sesame Chicken", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-sesame-shrimp", number: "C4", name: "Sesame Shrimp", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.10 }, options: comboOptions },
  { id: "combo-golden-finger-teriyaki-chicken", number: "C5", name: "Golden Finger & Teriyaki Chicken", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-golden-finger-teriyaki-beef", number: "C6", name: "Golden Finger & Teriyaki Beef", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.10 }, options: comboOptions },
  { id: "combo-chicken-shrimp-combo", number: "C6a", name: "Chicken and Shrimp Combination", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-chicken-garlic-pork", number: "C7", name: "Chicken with Garlic Sauce or Pork", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-shrimp-garlic-beef", number: "C8", name: "Shrimp with Garlic Sauce or Beef", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-general-tsos-chicken", number: "C9", name: "General Tso's Chicken", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-hunan-beef-chicken", number: "C10", name: "Hunan Beef or Chicken", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-general-tsos-shrimp", number: "C11", name: "General Tso's Shrimp", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.00 }, options: comboOptions },
  { id: "combo-kung-po-chicken", number: "C11a", name: "Kung Po Chicken with Peanuts", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-string-beans-garlic", number: "C12", name: "String Beans with Chicken or Shrimp in Garlic Sauce", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-crispy-orange-chicken", number: "C13", name: "Crispy Orange Chicken", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-eggplant-garlic", number: "C14", name: "Eggplant with Chicken or Shrimp in Garlic Sauce", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-honey-chicken", number: "C15", name: "Honey Chicken", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-sauteed-broccoli", number: "C16", name: "Sauteed Broccoli", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-tofu-mixed-vegetables", number: "C17", name: "Tofu with Mixed Vegetables", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-chicken-finger", number: "C18", name: "Chicken Finger", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 11.85 }, options: comboOptions },
  { id: "combo-coconut-shrimp", number: "C19", name: "Coconut Shrimp", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.00 }, options: comboOptions },

  { id: "seafood-combination", number: "138", name: "Seafood Combination", category: "Chef Specials", description: "Lobster chunks, crabmeat, jumbo shrimp, scallops, sauteed with assorted Chinese vegetables.", prices: { order: 17.95 }, options: riceOptions },
  { id: "happy-family", number: "139", name: "Happy Family", category: "Chef Specials", description: "Chicken, pork, seafood all mixed with assorted Chinese vegetables in special brown sauce.", prices: { order: 18.25 }, options: riceOptions },
  { id: "four-seasons", number: "140", name: "Four Seasons", category: "Chef Specials", description: "Shrimp, beef, chicken, roast pork with broccoli, snow peas and water chestnuts.", prices: { order: 15.45 }, options: riceOptions },
  { id: "chow-steak-kew", number: "142", name: "Chow Steak Kew (Beef)", category: "Chef Specials", description: "Fried beef with mixed vegetables.", prices: { order: 14.15 }, options: riceOptions },
  { id: "lemon-chicken", number: "143", name: "Lemon Chicken", category: "Chef Specials", prices: { order: 13.50 }, options: riceOptions },
  { id: "boneless-chicken", number: "144", name: "Boneless Chicken", category: "Chef Specials", description: "Chicken meat dipped into golden brown with mixed Chinese vegetables.", prices: { order: 13.50 }, options: riceOptions },
  { id: "subgum-wonton", number: "145", name: "Subgum Wonton", category: "Chef Specials", description: "Crabmeat, shrimp, chicken and roast pork with mixed vegetables, served with fried wonton.", prices: { order: 14.15 }, options: riceOptions },
  { id: "seven-stars-around-moon", number: "146", name: "Seven Stars Around the Moon (For 2)", category: "Chef Specials", description: "Chicken, beef, roast pork, scallops and crabmeat with all season vegetables topped with seven fantail shrimp.", prices: { order: 22.25 }, options: riceOptions },
  { id: "hawaii-delight", number: "147", name: "Hawaii Delight", category: "Chef Specials", description: "Mixed of beef, chicken, jumbo shrimp and roast pork with mixed vegetables in chef's special brown sauce.", prices: { order: 14.95 }, options: riceOptions },
  { id: "chow-gai-kew", number: "148", name: "Chow Gai Kew (Chicken)", category: "Chef Specials", description: "Breaded white meat chicken with brown sauce and mixed vegetables.", prices: { order: 13.50 }, options: riceOptions },
  { id: "triple-crown", number: "149", name: "Triple Crown", category: "Chef Specials", description: "Sliced tenderloin of roast pork, beef and chicken sauteed with green and red pepper in a delicate brown spicy sauce.", spicy: true, prices: { order: 14.75 }, options: riceOptions },
  { id: "tai-chien-chicken", number: "150", name: "Tai-Chien Chicken", category: "Chef Specials", description: "Breaded chunks of chicken with mixed vegetables in hot spicy Szechuan sauce.", spicy: true, prices: { order: 13.55 }, options: riceOptions },
  { id: "crispy-orange-beef", number: "151", name: "Crispy Orange Flavor Beef", category: "Chef Specials", spicy: true, prices: { order: 14.30 }, options: riceOptions },
  { id: "crispy-orange-chicken-chef", number: "151a", name: "Crispy Orange Flavor Chicken", category: "Chef Specials", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "twin-flavor-chicken", number: "152", name: "Twin Flavor Chicken", category: "Chef Specials", description: "Combination of General Tso's chicken and chicken with snow peas.", prices: { order: 15.95 }, options: riceOptions },
  { id: "dragon-phoenix", number: "153", name: "Dragon & Phoenix", category: "Chef Specials", description: "Spicy stir-fried jumbo shrimp and General Tso's chicken.", spicy: true, prices: { order: 15.95 }, options: riceOptions },
  { id: "shrimp-scallop-garlic", number: "154", name: "Shrimp & Scallop in Garlic Sauce", category: "Chef Specials", spicy: true, prices: { order: 15.95 }, options: riceOptions },
  { id: "mongolian-beef-chicken", number: "155", name: "Mongolian Beef or Chicken", category: "Chef Specials", description: "Snow peas, scallion, onion, sliced green pepper, beef with special spicy sauce.", spicy: true, prices: { order: 14.05 }, options: riceOptions },
  { id: "china-delight-chef", number: "156", name: "China Delight", category: "Chef Specials", description: "Fresh scallop, chicken, jumbo shrimp, broccoli, dry mushroom in garlic sauce.", spicy: true, prices: { order: 15.45 }, options: riceOptions },
  { id: "coconut-shrimp-or-chicken", number: "158", name: "Coconut Shrimp or Chicken", category: "Chef Specials", prices: { order: 15.65 }, options: riceOptions },
  { id: "hibachi-chicken", number: "159", name: "Hibachi Chicken", category: "Chef Specials", prices: { order: 16.55 }, options: riceOptions },

  { id: "diet-mixed-vegetables", number: "D1", name: "Mixed Chinese Vegetables", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 8.95, large: 12.55 }, options: riceOptions },
  { id: "diet-chicken-mixed-vegetables", number: "D2", name: "Chicken with Mixed Vegetables", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 8.95, large: 13.35 }, options: riceOptions },
  { id: "diet-chicken-broccoli", number: "D3", name: "Chicken with Broccoli", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 8.95, large: 13.35 }, options: riceOptions },
  { id: "diet-shrimp-broccoli", number: "D4", name: "Shrimp with Broccoli", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 9.35, large: 13.95 }, options: riceOptions },
  { id: "diet-buddhist-delight", number: "D5", name: "Buddhist Delight", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 8.95, large: 12.55 }, options: riceOptions },
  { id: "diet-string-bean", number: "D6", name: "String Bean Chicken or Shrimp", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 8.95, large: 13.95 }, options: riceOptions },

  { id: "lunch-mixed-vegetables", number: "LD1", name: "Mixed Chinese Vegetables", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-chicken-mixed-vegetables", number: "LD2", name: "Chicken with Mixed Vegetables", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-broccoli", number: "LD3", name: "Shrimp with Broccoli", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-broccoli", number: "LD4", name: "Chicken with Broccoli", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-string-bean-chicken-shrimp", number: "LD5", name: "String Bean Chicken or Shrimp", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-chow-mein", number: "L1", name: "Shrimp Chow Mein", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-chow-mein", number: "L2", name: "Chicken Chow Mein", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-beef-chicken-broccoli", number: "L3", name: "Beef or Chicken with Broccoli", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-roast-pork-chinese-vegetables", number: "L4", name: "Roast Pork with Chinese Vegetables", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-pepper-steak-onion", number: "L5", name: "Pepper Steak with Onion", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-lobster-sauce", number: "L6", name: "Shrimp with Lobster Sauce", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-moo-goo-gai-pan", number: "L7", name: "Moo Goo Gai Pan", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-shrimp-chicken-lo-mein", number: "L8", name: "Shrimp or Chicken Lo Mein", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-beef-chicken-garlic", number: "L9", name: "Beef or Chicken with Garlic Sauce", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-boneless-spare-ribs", number: "L10", name: "Boneless Spare Ribs", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-sweet-sour-pork-chicken", number: "L11", name: "Sweet & Sour Pork or Chicken", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-roast-pork-lo-mein", number: "L12", name: "Roast Pork Lo Mein", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-roast-pork-broccoli", number: "L13", name: "Roast Pork with Broccoli", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-cashew", number: "L14", name: "Chicken with Cashew Nuts", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-roast-pork-broccoli", number: "L14a", name: "Chicken or Roast Pork with Broccoli", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-chicken-beef-szechuan", number: "L15", name: "Chicken or Beef Szechuan Style", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-sesame-chicken", number: "L16", name: "Sesame Chicken", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-teriyaki-chicken-vegetable", number: "L17", name: "Teriyaki Chicken with Vegetable", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-teriyaki-beef-vegetable", number: "L17a", name: "Teriyaki Beef with Vegetable", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-chinese-vegetables", number: "L18", name: "Shrimp with Chinese Vegetables", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 10.25 }, options: lunchOptions },
  { id: "lunch-shrimp-mixed-vegetables", number: "L19", name: "Shrimp with Mixed Vegetables", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 10.25 }, options: lunchOptions },
  { id: "lunch-general-tsos-chicken", number: "L20", name: "General Tso's Chicken", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-broccoli-alt", number: "L21", name: "Shrimp with Broccoli", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-sauteed-mixed-vegetables", number: "L22", name: "Sauteed Mixed Vegetables", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },

  { id: "fortune-cookies", number: "S1", name: "Fortune Cookies", category: "Side Orders", prices: { order: 1.50 }, options: regularOptions },
  { id: "fried-noodles", number: "S2", name: "Fried Noodles", category: "Side Orders", prices: { order: 1.55 }, description: "1 bag.", options: regularOptions },
  { id: "extra-white-rice", number: "S3", name: "Extra White Rice", category: "Side Orders", prices: { small: 3.95, large: 5.35 }, options: regularOptions },
  { id: "extra-brown-rice", number: "S4", name: "Extra Brown Rice", category: "Side Orders", prices: { small: 4.25, large: 4.75 }, options: regularOptions }
];

type MenuSplit = { id: string; number: string; name: string; description?: string };

const menuItemSplits: Record<string, MenuSplit[]> = {
  "egg-roll": [
    { id: "egg-roll", number: "1A", name: "Egg Roll" },
    { id: "vegetable-egg-roll", number: "1B", name: "Vegetable Egg Roll" }
  ],
  "shrimp-roll": [
    { id: "shrimp-roll", number: "2A", name: "Shrimp Roll" },
    { id: "spring-roll", number: "2B", name: "Spring Roll" }
  ],
  "crab-rangoon": [
    { id: "crab-rangoon", number: "5A", name: "Crab Rangoon (10)" },
    { id: "cheese-wonton", number: "5B", name: "Cheese Wonton" }
  ],
  dumplings: [
    { id: "fried-dumplings", number: "15A", name: "Fried Dumpling (8)" },
    { id: "steamed-dumplings", number: "15B", name: "Steamed Dumpling (8)" }
  ],
  "vegetable-dumplings": [
    { id: "fried-vegetable-dumplings", number: "15C", name: "Fried Vegetable Dumpling (8)" },
    { id: "steamed-vegetable-dumplings", number: "15D", name: "Steamed Vegetable Dumpling (8)" }
  ],
  "shrimp-egg-foo-young": [
    { id: "shrimp-egg-foo-young", number: "96A", name: "Shrimp Egg Foo Young" },
    { id: "beef-egg-foo-young", number: "96B", name: "Beef Egg Foo Young" }
  ],
  "sauteed-broccoli": [
    { id: "sauteed-broccoli", number: "99A", name: "Sauteed Broccoli" },
    { id: "buddhist-delight-vegetable", number: "99B", name: "Buddhist Delight" }
  ],
  "chicken-chow-fun": [
    { id: "chicken-chow-fun", number: "104A", name: "Chicken Chow Fun" },
    { id: "chicken-mai-fun", number: "104B", name: "Chicken Mai Fun" }
  ],
  "pork-chow-fun": [
    { id: "pork-chow-fun", number: "105A", name: "Pork Chow Fun" },
    { id: "pork-mai-fun", number: "105B", name: "Pork Mai Fun" }
  ],
  "shrimp-chow-fun": [
    { id: "shrimp-chow-fun", number: "106A", name: "Shrimp Chow Fun" },
    { id: "shrimp-mai-fun", number: "106B", name: "Shrimp Mai Fun" }
  ],
  "singapore-chow-mai-fun": [
    { id: "singapore-chow-fun", number: "107A", name: "Singapore Chow Fun" },
    { id: "singapore-mai-fun", number: "107B", name: "Singapore Mai Fun" }
  ],
  "vegetable-chow-fun": [
    { id: "vegetable-chow-fun", number: "107C", name: "Vegetable Chow Fun" },
    { id: "vegetable-mai-fun", number: "107D", name: "Vegetable Mai Fun" }
  ],
  "wings-shrimp-fried-rice": [
    { id: "wings-shrimp-fried-rice", number: "110A", name: "Chicken Wings with Shrimp Fried Rice" },
    { id: "wings-beef-fried-rice", number: "110B", name: "Chicken Wings with Beef Fried Rice" }
  ],
  "moo-shu-pork-chicken": [
    { id: "moo-shu-pork", number: "112A", name: "Moo Shu Pork" },
    { id: "moo-shu-chicken", number: "112B", name: "Moo Shu Chicken" }
  ],
  "moo-shu-shrimp-beef": [
    { id: "moo-shu-shrimp", number: "113A", name: "Moo Shu Shrimp" },
    { id: "moo-shu-beef", number: "113B", name: "Moo Shu Beef" }
  ],
  "combo-bbq-ribs": [
    { id: "combo-bbq-ribs", number: "C1A", name: "Bar-B-Q Spare Ribs" },
    { id: "combo-boneless-spare-ribs", number: "C1B", name: "Boneless Spare Ribs" }
  ],
  "combo-chicken-garlic-pork": [
    { id: "combo-chicken-garlic-sauce", number: "C7A", name: "Chicken with Garlic Sauce" },
    { id: "combo-pork-garlic-sauce", number: "C7B", name: "Pork with Garlic Sauce" }
  ],
  "combo-shrimp-garlic-beef": [
    { id: "combo-shrimp-garlic-sauce", number: "C8A", name: "Shrimp with Garlic Sauce" },
    { id: "combo-beef-garlic-sauce", number: "C8B", name: "Beef with Garlic Sauce" }
  ],
  "combo-hunan-beef-chicken": [
    { id: "combo-hunan-beef", number: "C10A", name: "Hunan Beef" },
    { id: "combo-hunan-chicken", number: "C10B", name: "Hunan Chicken" }
  ],
  "combo-string-beans-garlic": [
    { id: "combo-string-beans-chicken-garlic", number: "C12A", name: "String Beans with Chicken in Garlic Sauce" },
    { id: "combo-string-beans-shrimp-garlic", number: "C12B", name: "String Beans with Shrimp in Garlic Sauce" }
  ],
  "combo-eggplant-garlic": [
    { id: "combo-eggplant-chicken-garlic", number: "C14A", name: "Eggplant with Chicken in Garlic Sauce" },
    { id: "combo-eggplant-shrimp-garlic", number: "C14B", name: "Eggplant with Shrimp in Garlic Sauce" }
  ],
  "mongolian-beef-chicken": [
    { id: "mongolian-beef", number: "155A", name: "Mongolian Beef" },
    { id: "mongolian-chicken", number: "155B", name: "Mongolian Chicken" }
  ],
  "coconut-shrimp-or-chicken": [
    { id: "coconut-shrimp-chef", number: "158A", name: "Coconut Shrimp" },
    { id: "coconut-chicken-chef", number: "158B", name: "Coconut Chicken" }
  ],
  "diet-string-bean": [
    { id: "diet-string-bean-chicken", number: "D6A", name: "String Bean Chicken" },
    { id: "diet-string-bean-shrimp", number: "D6B", name: "String Bean Shrimp" }
  ],
  "lunch-string-bean-chicken-shrimp": [
    { id: "lunch-string-bean-chicken", number: "LD5A", name: "String Bean Chicken" },
    { id: "lunch-string-bean-shrimp", number: "LD5B", name: "String Bean Shrimp" }
  ],
  "lunch-beef-chicken-broccoli": [
    { id: "lunch-beef-broccoli", number: "L3A", name: "Beef with Broccoli" },
    { id: "lunch-chicken-broccoli-l3", number: "L3B", name: "Chicken with Broccoli" }
  ],
  "lunch-shrimp-chicken-lo-mein": [
    { id: "lunch-shrimp-lo-mein", number: "L8A", name: "Shrimp Lo Mein" },
    { id: "lunch-chicken-lo-mein", number: "L8B", name: "Chicken Lo Mein" }
  ],
  "lunch-beef-chicken-garlic": [
    { id: "lunch-beef-garlic-sauce", number: "L9A", name: "Beef with Garlic Sauce" },
    { id: "lunch-chicken-garlic-sauce", number: "L9B", name: "Chicken with Garlic Sauce" }
  ],
  "lunch-sweet-sour-pork-chicken": [
    { id: "lunch-sweet-sour-pork", number: "L11A", name: "Sweet & Sour Pork" },
    { id: "lunch-sweet-sour-chicken", number: "L11B", name: "Sweet & Sour Chicken" }
  ],
  "lunch-chicken-roast-pork-broccoli": [
    { id: "lunch-chicken-broccoli-l14a", number: "L14A", name: "Chicken with Broccoli" },
    { id: "lunch-roast-pork-broccoli-l14a", number: "L14B", name: "Roast Pork with Broccoli" }
  ],
  "lunch-chicken-beef-szechuan": [
    { id: "lunch-chicken-szechuan", number: "L15A", name: "Chicken Szechuan Style" },
    { id: "lunch-beef-szechuan", number: "L15B", name: "Beef Szechuan Style" }
  ]
};

export const splitMenuItemsReport = Object.entries(menuItemSplits).flatMap(([sourceId, splits]) =>
  splits.map((split) => `${sourceId} -> #${split.number} ${split.name}`)
);

function applyMenuSplits(items: MenuItem[]) {
  return items.flatMap((item) => {
    const splits = menuItemSplits[item.id];
    if (!splits) return [item];
    return splits.map((split) => ({ ...item, ...split }));
  });
}

export const menuItems: MenuItem[] = applyMenuSplits(rawMenuItems).map((item) => ({
  ...item,
  options: {
    ...item.options,
    lunchChoices: item.category === "Lunch Special" ? true : item.options?.lunchChoices,
    comboIncluded: item.category === "Special Combination Platters" ? true : item.options?.comboIncluded
  }
}));

