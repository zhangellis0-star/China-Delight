import type { MenuCategory, MenuItem } from "@/types";

const printedMenuCategories: MenuCategory[] = [
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
export const menuDataReviewNotes = [
  "Every item has a chineseName using standard Simplified Chinese restaurant terminology, not transcribed from the physical menu's printed Chinese (photos too small/blurry to read). Compare against the paper menu and correct any item where the restaurant's own wording differs.",
  "Item numbers/prices marked NEEDS_REVIEW should be checked against the paper menu before accepting live orders.",
  "Review Appetizers around printed numbers 12-15 against the physical menu; the photo is readable enough for the current seed but still slightly angled.",
  "Review any hidden fold items not visible in the photos, especially skipped printed numbers such as Chef Specials 141 and 157, Seafood 88, and Szechuan/Hunan 123 and 131."
];

const rawMenuItems: MenuItem[] = [
  { id: "egg-roll", number: "1", name: "Egg Roll or Vegetable Egg Roll", chineseName: "蛋卷或素菜蛋卷", category: "Appetizers", prices: { order: 2.45 }, options: regularOptions },
  { id: "shrimp-roll", number: "2", name: "Shrimp Roll or Spring Roll", chineseName: "虾卷或春卷", category: "Appetizers", prices: { order: 2.45 }, options: regularOptions },
  { id: "fantail-shrimp", number: "3", name: "Fantail Shrimp", chineseName: "凤尾虾", category: "Appetizers", prices: { order: 2.45 }, options: regularOptions },
  { id: "fried-wonton", number: "5", name: "Fried Wonton (12)", chineseName: "炸云吞", category: "Appetizers", prices: { order: 6.95 }, options: regularOptions },
  { id: "crab-rangoon", number: "6", name: "Crab Rangoon (10) or Cheese Wonton", chineseName: "蟹角或芝士云吞", category: "Appetizers", prices: { order: 8.95 }, options: regularOptions },
  { id: "teriyaki-beef", number: "8", name: "Teriyaki Beef (2)", chineseName: "牛串", category: "Appetizers", prices: { order: 6.75 }, options: regularOptions },
  { id: "bar-b-q-spare-ribs", number: "9", name: "Bar-B-Q Spare Ribs", chineseName: "排骨", category: "Appetizers", prices: { small: 9.85, large: 19.25 }, options: regularOptions, description: "With Bone" },
  { id: "boneless-spare-ribs", number: "11", name: "Boneless Spare Ribs", chineseName: "无骨排", category: "Appetizers", prices: { small: 9.85, large: 19.25 }, options: regularOptions },
  { id: "golden-finger-chicken", number: "12", name: "Golden Finger Chicken", chineseName: "金手指", category: "Appetizers", prices: { order: 10.35 }, options: regularOptions },
  { id: "chicken-nugget", number: "12a", name: "Chicken Nugget", chineseName: "鸡块", category: "Appetizers", prices: { order: 7.25 }, options: regularOptions },
  { id: "fried-chicken-wings-(4pcs)", number: "13", name: "Fried Chicken Wings", chineseName: "鸡翅", category: "Appetizers", prices: { order: 7.25 }, options: regularOptions },
  { id: "dumplings", number: "14", name: "Dumpling, Pan Fried or Steamed (8)", chineseName: "锅贴或水饺", category: "Appetizers", prices: { order: 9.25 }, options: regularOptions },
  { id: "vegetable-dumplings", number: "15", name: "Vegetable Dumpling, Pan Fried or Steamed (8)", chineseName: "菜锅贴或菜饺", category: "Appetizers", prices: { order: 9.25 }, options: regularOptions },
  { id: "pu-pu-platter", number: "16", name: "Pu Pu Platter", chineseName: "大宝", category: "Appetizers", prices: { order: 16.55 }, description: "Egg roll(2), crab rangoon(2), golden finger(6), fantail shrimp(2), fried wonton(6), BBQ spare ribs(2), teriyaki beef(2).", options: regularOptions },
  { id: "mini-pu-pu-platter", number: "16a", name: "Mini Pu Pu Platter", chineseName: "小宝", category: "Appetizers", prices: { order: 15.95 }, description: "Egg roll(1), Cheese Wonton(7), Teriyaki Chicken(2), golden finger(7).", options: regularOptions },
  { id: "cold-sesame-noodles", number: "17", name: "Cold Sesame Noodles", chineseName: "凉面", category: "Appetizers", spicy: true, prices: { order: 9.35 }, options: regularOptions },
  { id: "steamed-wonton-sesame", number: "17a", name: "Steamed Wonton in Sesame Peanut Sauce", chineseName: "麻酱云吞", category: "Appetizers", prices: { order: 9.35 }, options: regularOptions },
  { id: "pan-fried-wonton-ginger", number: "18", name: "Pan Fried Wonton with Ginger Sauce", chineseName: "姜汁煎云吞", category: "Appetizers", prices: { order: 9.35 }, options: regularOptions },
  { id: "sugar-donut", number: "19", name: "Sugar Donut (10)", chineseName: "炸糖球", category: "Appetizers", prices: { order: 9.35 }, options: regularOptions },
  { id: "fried-shrimp-app", number: "19a", name: "Fried Shrimp", chineseName: "炸虾", category: "Appetizers", prices: { order: 9.35 }, options: regularOptions },
  { id: "teriyaki-chicken", number: "20", name: "Teriyaki Chicken (3)", chineseName: "鸡串", category: "Appetizers", prices: { order: 6.80 }, options: regularOptions },
  { id: "french-fries", number: "20b", name: "French Fries", chineseName: "薯条", category: "Appetizers", prices: { order: 7.75 }, options: regularOptions },

  { id: "wonton-soup", number: "21", name: "Wonton Soup", chineseName: "云吞汤", category: "Soup", description: "With fried noodles.", prices: { pint: 4.65, quart: 7.45 }, options: regularOptions },
  { id: "egg-drop-soup", number: "22", name: "Egg Drop Soup", chineseName: "蛋花汤", category: "Soup", description: "With fried noodles.", prices: { pint: 4.65, quart: 7.45 }, options: regularOptions },
  { id: "chicken-noodle-soup", number: "23", name: "Chicken Noodle Soup", chineseName: "鸡面汤", category: "Soup", description: "With fried noodles.", prices: { pint: 4.65, quart: 7.45 }, options: regularOptions },
  { id: "chicken-rice-soup", number: "24", name: "Chicken Rice Soup", chineseName: "鸡饭汤", category: "Soup", description: "With fried noodles.", prices: { pint: 4.65, quart: 7.45 }, options: regularOptions },
  { id: "wonton-egg-drop-mixed-soup", number: "25", name: "Wonton Egg Drop Mixed Soup", chineseName: "云吞蛋花汤", category: "Soup", description: "With fried noodles.", prices: { pint: 5.60, quart: 8.50 }, options: regularOptions },
  { id: "vegetable-soup", number: "26", name: "Vegetable Soup", chineseName: "菜汤", category: "Soup", description: "With fried noodles.", prices: { pint: 5.60, quart: 8.50 }, options: regularOptions },
  { id: "hot-sour-soup", number: "27", name: "Hot & Sour Soup", chineseName: "酸辣汤", category: "Soup", spicy: true, description: "With fried noodles.", prices: { pint: 6.10, quart: 8.50 }, options: regularOptions },
  { id: "house-special-soup", number: "28", name: "House Special Soup", chineseName: "本楼汤", category: "Soup", description: "With fried noodles.", prices: { quart: 8.50 }, options: regularOptions },
  { id: "chicken-vegetable-soup", number: "29", name: "Chicken with Vegetable Soup", chineseName: "鸡肉蔬菜汤", category: "Soup", description: "With fried noodles.", prices: { quart: 8.50 }, options: regularOptions },
  { id: "bean-curd-subgum-wonton-soup", number: "30", name: "Bean Curd Subgum Wonton Soup", chineseName: "豆腐什锦云吞汤", category: "Soup", description: "With fried noodles.", prices: { quart: 8.50 }, options: regularOptions },

  { id: "roast-pork-fried-rice", number: "31", name: "Roast Pork Fried Rice", chineseName: "叉烧炒饭", category: "Fried Rice", prices: { pint: 6.95, quart: 10.50 }, options: regularOptions },
  { id: "chicken-fried-rice", number: "32", name: "Chicken Fried Rice", chineseName: "鸡炒饭", category: "Fried Rice", prices: { pint: 6.95, quart: 10.50 }, options: regularOptions },
  { id: "shrimp-fried-rice", number: "33", name: "Shrimp Fried Rice", chineseName: "虾炒饭", category: "Fried Rice", prices: { pint: 6.95, quart: 11.40 }, options: regularOptions },
  { id: "beef-fried-rice", number: "34", name: "Beef Fried Rice", chineseName: "牛炒饭", category: "Fried Rice", prices: { pint: 6.95, quart: 11.40 }, options: regularOptions },
  { id: "vegetable-fried-rice", number: "35", name: "Vegetable Fried Rice", chineseName: "菜炒饭", category: "Fried Rice", prices: { pint: 6.95, quart: 10.50 }, options: regularOptions },
  { id: "house-special-fried-rice", number: "36", name: "House Special Fried Rice", chineseName: "本楼炒饭", category: "Fried Rice", prices: { pint: 6.95, quart: 11.40 }, options: regularOptions },
  { id: "plain-fried-rice", number: "37", name: "Plain Fried Rice", chineseName: "黄饭", category: "Fried Rice", prices: { pint: 6.20, quart: 10.50 }, options: regularOptions },
  { id: "egg-fried-rice", number: "38", name: "Egg Fried Rice", chineseName: "蛋炒饭", category: "Fried Rice", prices: { pint: 6.95, quart: 10.50 }, options: regularOptions },

  { id: "roast-pork-lo-mein", number: "39", name: "Roast Pork Lo Mein", chineseName: "叉烧捞面", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.85, quart: 11.75, combo: 11.75 }, options: regularOptions },
  { id: "chicken-lo-mein", number: "40", name: "Chicken Lo Mein", chineseName: "鸡捞面", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.85, quart: 11.75, combo: 11.75 }, options: regularOptions },
  { id: "shrimp-lo-mein", number: "41", name: "Shrimp Lo Mein", chineseName: "虾捞面", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.85, quart: 11.75, combo: 11.75 }, options: regularOptions },
  { id: "beef-lo-mein", number: "42", name: "Beef Lo Mein", chineseName: "牛捞面", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.85, quart: 11.75, combo: 11.75 }, options: regularOptions },
  { id: "vegetable-lo-mein", number: "43", name: "Vegetable Lo Mein", chineseName: "菜捞面", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.85, quart: 11.75, combo: 11.75 }, options: regularOptions },
  { id: "plain-lo-mein", number: "43a", name: "Plain Lo Mein", chineseName: "尽捞面", category: "Lo Mein", description: "Soft noodles.", prices: { pint: 8.85, quart: 11.75 }, options: regularOptions },
  { id: "house-special-lo-mein", number: "44", name: "House Special Lo Mein", chineseName: "本楼捞面", category: "Lo Mein", description: "Soft noodles.", prices: { order: 12.70 }, options: regularOptions },


  { id: "roast-pork-chinese-vegetables", number: "59", name: "Roast Pork with Chinese Vegetables", chineseName: "叉烧中国杂菜", category: "Roast Pork", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "roast-pork-black-bean", number: "60", name: "Roast Pork with Black Bean Sauce", chineseName: "豉汁叉烧", category: "Roast Pork", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "roast-pork-broccoli", number: "62", name: "Roast Pork with Broccoli", chineseName: "芥兰叉烧", category: "Roast Pork", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "roast-pork-mixed-vegetables", number: "62a", name: "Roast Pork with Mixed Vegetables", chineseName: "叉烧杂菜", category: "Roast Pork", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },

 
  { id: "beef-chinese-vegetables", number: "64", name: "Beef with Chinese Vegetables", chineseName: "时蔬牛肉", category: "Beef", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "beef-mushroom-oyster", number: "65", name: "Beef with Mushroom Oyster Sauce", chineseName: "蘑菇蚝油牛肉", category: "Beef", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "beef-green-pepper-tomato", number: "66", name: "Beef with Green Pepper & Tomato", chineseName: "青椒番茄牛肉", category: "Beef", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "pepper-steak-onion", number: "67", name: "Pepper Steak with Onion", chineseName: "洋葱青椒牛肉", category: "Beef", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "beef-broccoli", number: "68", name: "Beef with Broccoli", chineseName: "芥兰牛", category: "Beef", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "curry-beef-onion", number: "69", name: "Curry Beef with Onion", chineseName: "咖喱牛", category: "Beef", spicy: true, description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "beef-mixed-vegetables", number: "69a", name: "Beef with Mixed Vegetables", chineseName: "杂菜牛", category: "Beef", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },

 
  { id: "moo-goo-gai-pan", number: "71", name: "Moo Goo Gai Pan", chineseName: "蘑菇鸡片", category: "Chicken", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "chicken-green-pepper-tomato", number: "72", name: "Chicken with Green Pepper & Tomato", chineseName: "青椒番茄鸡", category: "Chicken", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "chicken-mushroom-oyster", number: "73", name: "Chicken with Mushroom Oyster Sauce", chineseName: "蘑菇蚝油鸡", category: "Chicken", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "chicken-black-bean", number: "74", name: "Chicken with Black Bean Sauce", chineseName: "豉汁鸡", category: "Chicken", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "chicken-cashew-nuts", number: "75", name: "Chicken with Cashew Nuts", chineseName: "腰果鸡", category: "Chicken", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "chicken-mixed-vegetables", number: "76", name: "Chicken with Mixed Vegetables", chineseName: "杂菜鸡", category: "Chicken", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "chicken-broccoli", number: "77", name: "Chicken with Broccoli", chineseName: "芥兰鸡", category: "Chicken", description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "curry-chicken-onion", number: "78", name: "Curry Chicken with Onion", chineseName: "咖喱鸡", category: "Chicken", spicy: true, description: "With white rice.", prices: { pint: 9.55, quart: 13.95, combo: 12.35 }, options: riceOptions },
  { id: "black-pepper-chicken", number: "78a", name: "Black Pepper Chicken", chineseName: "黑椒鸡", category: "Chicken", description: "With white rice.", prices: {quart: 13.95, combo: 12.35 }, options: riceOptions },

  { id: "Black Pepper Shrimp", number: "79", name: "Black Pepper Shrimp", chineseName: "黑椒虾", category: "Seafood", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },

  { id: "shrimp-chinese-vegetables", number: "81", name: "Shrimp with Chinese Vegetables", chineseName: "时蔬虾仁", category: "Seafood", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "shrimp-green-pepper-tomato", number: "82", name: "Shrimp with Green Pepper & Tomato", chineseName: "青椒番茄虾仁", category: "Seafood", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "shrimp-black-bean", number: "83", name: "Shrimp with Black Bean Sauce", chineseName: "豉汁虾仁", category: "Seafood", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "shrimp-cashew-nuts", number: "84", name: "Shrimp with Cashew Nuts", chineseName: "腰果虾仁", category: "Seafood", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "shrimp-broccoli", number: "85", name: "Shrimp with Broccoli", chineseName: "西兰花虾仁", category: "Seafood", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "shrimp-mixed-vegetables", number: "86", name: "Shrimp with Mixed Vegetables", chineseName: "什锦虾仁", category: "Seafood", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "shrimp-lobster-sauce-alt", number: "87", name: "Shrimp with Lobster Sauce", chineseName: "龙虾汁虾仁", category: "Seafood", description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },
  { id: "curry-shrimp-onion", number: "89", name: "Curry Shrimp with Onion", chineseName: "咖喱虾仁", category: "Seafood", spicy: true, description: "With white rice.", prices: { pint: 9.80, quart: 14.20, combo: 12.60 }, options: riceOptions },

  { id: "sweet-sour-pork", number: "90", name: "Sweet & Sour Pork", chineseName: "甜酸肉", category: "Sweet & Sour", description: "With white rice.", prices: { pint: 9.45, quart: 12.35, combo: 12.45 }, options: riceOptions },
  { id: "sweet-sour-chicken", number: "91", name: "Sweet & Sour Chicken", chineseName: "甜酸鸡", category: "Sweet & Sour", description: "With white rice.", prices: { pint: 9.45, quart: 12.35, combo: 12.45 }, options: riceOptions },
  { id: "sweet-sour-shrimp", number: "92", name: "Sweet & Sour Shrimp", chineseName: "甜酸虾", category: "Sweet & Sour", description: "With white rice.", prices: { pint: 9.45, quart: 12.35, combo: 12.45 }, options: riceOptions },
  { id: "sweet-sour-triple", number: "93", name: "Sweet & Sour Triple", chineseName: "甜酸三样", category: "Sweet & Sour", description: "Chicken, pork, shrimp. Per order.", prices: { order: 13.45 }, options: riceOptions },

  { id: "roast-pork-egg-foo-young", number: "94", name: "Roast Pork Egg Foo Young", chineseName: "叉烧蓉蛋", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.95, combo: 11.95 }, options: riceOptions },
  { id: "chicken-egg-foo-young", number: "95", name: "Chicken Egg Foo Young", chineseName: "鸡蓉蛋", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.95, combo: 11.95 }, options: riceOptions },
  { id: "shrimp-egg-foo-young", number: "96", name: "Shrimp Egg Foo Young or Beef", chineseName: "虾或牛蓉蛋", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.95, combo: 11.95 }, options: riceOptions },
  { id: "mushroom-egg-foo-young", number: "97", name: "Mushroom Egg Foo Young", chineseName: "蘑菇蓉蛋", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.95, combo: 11.95 }, options: riceOptions },
  { id: "house-special-egg-foo-young", number: "97a", name: "House Special Egg Foo Young", chineseName: "本楼蓉蛋", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.95, combo: 11.95 }, options: riceOptions },
  { id: "vegetable-egg-foo-young", number: "98", name: "Vegetable Egg Foo Young", chineseName: "菜蓉蛋", category: "Egg Foo Young", description: "With white rice.", prices: { order: 11.95, combo: 11.95 }, options: riceOptions },

  { id: "sauteed-broccoli", number: "99", name: "Sauteed Broccoli or Buddhist Delight", chineseName: "炒西兰花或罗汉斋", category: "Vegetable", description: "With white rice.", prices: { order: 12.35 }, options: riceOptions },
  { id: "tofu-broccoli", number: "99a", name: "Tofu with Broccoli", chineseName: "芥兰豆腐", category: "Vegetable", description: "With white rice.", prices: { order: 12.35 }, options: riceOptions },
  { id: "mixed-chinese-vegetables", number: "100", name: "Mixed Chinese Vegetables", chineseName: "什锦时蔬", category: "Vegetable", description: "With white rice.", prices: { order: 12.35 }, options: riceOptions },
  { id: "eggplant-garlic-sauce", number: "100a", name: "Eggplant & Broccoli with Garlic Sauce", chineseName: "鱼香茄子芥兰", category: "Vegetable", spicy: true, description: "With white rice.", prices: { order: 12.35 }, options: riceOptions },
  { id: "tofu-mixed-vegetables", number: "101", name: "Tofu with Mixed Vegetables", chineseName: "杂菜豆腐", category: "Vegetable", description: "With white rice.", prices: { order: 12.35 }, options: riceOptions },
  { id: "broccoli-garlic-sauce", number: "102", name: "Broccoli with Garlic Sauce", chineseName: "鱼香芥兰", category: "Vegetable", spicy: true, description: "With white rice.", prices: { order: 12.35 }, options: riceOptions },
  { id: "bean-curd-home-style", number: "103", name: "Bean Curd Home Style", chineseName: "家常豆腐", category: "Vegetable", description: "With white rice.", prices: { order: 12.35 }, options: riceOptions },
  { id: "string-beans-broccoli-garlic", number: "103a", name: "String Beans & Broccoli in Garlic Sauce", chineseName: "鱼香四季豆芥兰", category: "Vegetable", spicy: true, description: "With white rice.", prices: { order: 12.35 }, options: riceOptions },

  { id: "chicken-chow-fun", number: "104", name: "Chicken Chow Fun or Mai Fun", chineseName: "鸡河粉或炒米粉", category: "Chow Fun/Mai Fun", prices: { order: 12.45 }, options: regularOptions },
  { id: "pork-chow-fun", number: "105", name: "Pork Chow Fun or Mai Fun", chineseName: "猪河粉或米粉", category: "Chow Fun/Mai Fun", prices: { order: 12.45 }, options: regularOptions },
  { id: "shrimp-chow-fun", number: "106", name: "Shrimp Chow Fun or Mai Fun", chineseName: "虾河粉或米粉", category: "Chow Fun/Mai Fun", prices: { order: 12.45 }, options: regularOptions },
   { id: "beef-chow-fun", number: "106a", name: "Beef Chow Fun or Mai Fun", chineseName: "牛河粉或米粉", category: "Chow Fun/Mai Fun", prices: { order: 12.45 }, options: regularOptions },
  { id: "singapore-chow-mai-fun", number: "107", name: "Singapore Chow Fun or Mai Fun", chineseName: "星洲河粉或米粉", category: "Chow Fun/Mai Fun", spicy: true, prices: { order: 13.20 }, options: regularOptions },
  { id: "vegetable-chow-fun", number: "107a", name: "Vegetable Chow Fun or Mai Fun", chineseName: "菜河粉或米粉", category: "Chow Fun/Mai Fun", prices: { order: 12.45 }, options: regularOptions },
  { id: "house-special-chow-fun", number: "107b", name: "House Special Mai Fun", chineseName: "本楼米粉", category: "Chow Fun/Mai Fun", prices: { order: 13.20 }, options: regularOptions },

  { id: "wings-french-fries", number: "108", name: "Chicken Wings with French Fries", chineseName: "鸡翅薯条", category: "Wings", prices: { order: 12.35 }, options: regularOptions },
  { id: "wings-pork-fried-rice", number: "109", name: "Chicken Wings with Pork Fried Rice", chineseName: "鸡翅叉烧炒饭", category: "Wings", prices: { order: 12.35 }, options: regularOptions },
  { id: "wings-shrimp-fried-rice", number: "110", name: "Chicken Wings with Shrimp Fried Rice or Beef", chineseName: "鸡翅虾仁炒饭或牛肉炒饭", category: "Wings", prices: { order: 12.35 }, options: regularOptions },
  { id: "wings-white-rice", number: "111", name: "Chicken Wings with White Rice", chineseName: "鸡翅白饭", category: "Wings", prices: { order: 12.35 }, options: regularOptions },

  { id: "moo-shu-pork-chicken", number: "112", name: "Moo Shu Pork or Chicken", chineseName: "木须肉或木须鸡", category: "Szechuan & Hunan Dishes", description: "With white rice except moo shu dishes.", prices: { order: 12.95 }, options: riceOptions },
  { id: "moo-shu-shrimp-beef", number: "113", name: "Moo Shu Shrimp or Beef", chineseName: "木须虾或木须牛肉", category: "Szechuan & Hunan Dishes", description: "With white rice except moo shu dishes.", prices: { order: 12.95 }, options: riceOptions },
  { id: "moo-shu-vegetable", number: "114", name: "Moo Shu Vegetable", chineseName: "木须素菜", category: "Szechuan & Hunan Dishes", description: "With white rice except moo shu dishes.", prices: { order: 12.95 }, options: riceOptions },
  { id: "chicken-string-bean", number: "115", name: "Chicken with String Bean", chineseName: "四季豆鸡", category: "Szechuan & Hunan Dishes", prices: { order: 13.85 }, options: riceOptions },
  { id: "shrimp-string-bean", number: "116", name: "Shrimp with String Bean", chineseName: "四季豆虾", category: "Szechuan & Hunan Dishes", prices: { order: 13.85 }, options: riceOptions },
  { id: "sesame-chicken", number: "117", name: "Sesame Chicken", chineseName: "芝麻鸡", category: "Szechuan & Hunan Dishes", prices: { order: 14.70 }, options: riceOptions },
  { id: "sesame-beef", number: "118", name: "Sesame Beef", chineseName: "芝麻牛", category: "Szechuan & Hunan Dishes", prices: { order: 14.70 }, options: riceOptions },
  { id: "sesame-shrimp", number: "119", name: "Sesame Shrimp", chineseName: "芝麻虾", category: "Szechuan & Hunan Dishes", prices: { order: 14.70 }, options: riceOptions },
  { id: "beef-szechuan-style", number: "120", name: "Beef Szechuan Style", chineseName: "四川牛", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "hunan-chicken", number: "121", name: "Hunan Chicken", chineseName: "湖南鸡", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "hunan-beef", number: "122", name: "Hunan Beef", chineseName: "湖南牛", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "chicken-garlic-sauce", number: "124", name: "Chicken with Garlic Sauce", chineseName: "鱼香鸡", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "beef-garlic-sauce", number: "125", name: "Beef with Garlic Sauce", chineseName: "鱼香牛", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "shrimp-garlic-sauce", number: "126", name: "Shrimp with Garlic Sauce", chineseName: "鱼香虾", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 14.20 }, options: riceOptions },
  { id: "kung-po-chicken", number: "127", name: "Kung Po Chicken with Peanuts", chineseName: "宫保鸡丁", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "kung-po-shrimp", number: "128", name: "Kung Po Shrimp with Peanuts", chineseName: "宫保虾", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "shrimp-chicken-garlic", number: "129", name: "Shrimp & Chicken in Garlic Sauce", chineseName: "鱼香虾和鸡", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "general-tsos-tofu", number: "130", name: "General Tso's Tofu", chineseName: "左宗豆腐", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "shrimp-szechuan-style", number: "132", name: "Shrimp Szechuan Style", chineseName: "四川虾", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "shrimp-chicken-hunan", number: "133", name: "Shrimp & Chicken Hunan Style", chineseName: "湖南虾和鸡", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.95 }, options: riceOptions },
  { id: "general-tsos-shrimp", number: "134", name: "General Tso's Shrimp", chineseName: "左宗虾", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 14.70 }, options: riceOptions },
  { id: "general-tsos-chicken", number: "135", name: "General Tso's Chicken", chineseName: "左宗鸡", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 14.70 }, options: riceOptions },
  { id: "chicken-szechuan-style", number: "136", name: "Chicken Szechuan Style", chineseName: "四川鸡", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 13.45 }, options: riceOptions },
  { id: "general-tsos-double", number: "137", name: "General Tso's Double (Chicken & Shrimp)", chineseName: "左宗鸡虾双拼", category: "Szechuan & Hunan Dishes", spicy: true, prices: { order: 14.70 }, options: riceOptions },
  { id: "honey-chicken", number: "137b", name: "Honey Chicken", chineseName: "蜜鸡", category: "Szechuan & Hunan Dishes", prices: { order: 14.70 }, options: riceOptions },

  { id: "combo-bbq-ribs", number: "C1", name: "Bar-B-Q Spare Ribs or Boneless", chineseName: "叉烧排骨或无骨排骨", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.45 }, options: comboOptions },
  { id: "combo-boneless-chicken-finger", number: "C2", name: "Boneless & Chicken Finger", chineseName: "无骨排骨鸡柳", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.95 }, options: comboOptions },
    { id: "combo-boneless-general-tso's-chicken", number: "C2b", name: "Boneless & General Tso's Chicken", chineseName: "无骨排骨左宗鸡", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.95 }, options: comboOptions },
  { id: "combo-sesame-chicken", number: "C3", name: "Sesame Chicken", chineseName: "芝麻鸡", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-sesame-shrimp", number: "C4", name: "Sesame Shrimp", chineseName: "芝麻虾", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.60 }, options: comboOptions },
  { id: "combo-golden-finger-teriyaki-chicken", number: "C5", name: "Golden Finger & Teriyaki Chicken", chineseName: "鸡手指鸡串", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-golden-finger-teriyaki-beef", number: "C6", name: "Golden Finger & Teriyaki Beef", chineseName: "鸡手指牛串", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.60 }, options: comboOptions },
  { id: "combo-chicken-shrimp-combo", number: "C6a", name: "Chicken and Shrimp Combination", chineseName: "鸡虾双拼", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-chicken-garlic-pork", number: "C7", name: "Chicken with Garlic Sauce or Pork", chineseName: "鱼香鸡或鱼香叉烧", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-shrimp-garlic-beef", number: "C8", name: "Shrimp with Garlic Sauce or Beef", chineseName: "鱼香虾或鱼香牛", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-general-tsos-chicken", number: "C9", name: "General Tso's Chicken", chineseName: "左宗鸡", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-hunan-beef-chicken", number: "C10", name: "Hunan Beef or Chicken", chineseName: "湖南牛或湖南鸡", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-general-tsos-shrimp", number: "C11", name: "General Tso's Shrimp", chineseName: "左宗虾", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.50 }, options: comboOptions },
  { id: "combo-kung-po-chicken", number: "C11a", name: "Kung Po Chicken with Peanuts", chineseName: "宫保鸡丁", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-string-beans-garlic", number: "C12", name: "String Beans with Chicken or Shrimp in Garlic Sauce", chineseName: "鱼香四季豆鸡或虾", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-crispy-orange-chicken", number: "C13", name: "Crispy Orange Chicken", chineseName: "陈皮鸡", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-eggplant-garlic", number: "C14", name: "Eggplant with Chicken or Shrimp in Garlic Sauce", chineseName: "鱼香茄子鸡或虾", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", spicy: true, prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-honey-chicken", number: "C15", name: "Honey Chicken", chineseName: "蜜鸡", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-sauteed-broccoli", number: "C16", name: "Sauteed Broccoli", chineseName: "炒芥兰", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-tofu-mixed-vegetables", number: "C17", name: "Tofu with Mixed Vegetables", chineseName: "豆腐杂菜", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-chicken-finger", number: "C18", name: "Chicken Finger", chineseName: "鸡手指", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.35 }, options: comboOptions },
  { id: "combo-coconut-shrimp", number: "C19", name: "Coconut Shrimp", chineseName: "椰子虾", category: "Special Combination Platters", description: "Each plate served with egg roll and pork fried rice.", prices: { combo: 12.50 }, options: comboOptions },

  { id: "seafood-combination", number: "138", name: "Seafood Combination", chineseName: "海鲜大会", category: "Chef Specials", description: "Lobster chunks, crabmeat, jumbo shrimp, scallops, sauteed with assorted Chinese vegetables.", prices: { order: 18.20 }, options: riceOptions },
  { id: "happy-family", number: "139", name: "Happy Family", chineseName: "全家福", category: "Chef Specials", description: "Chicken, pork, seafood all mixed with assorted Chinese vegetables in special brown sauce.", prices: { order: 18.50 }, options: riceOptions },
  { id: "four-seasons", number: "140", name: "Four Seasons", chineseName: "炒四季", category: "Chef Specials", description: "Shrimp, beef, chicken, roast pork with broccoli, snow peas and water chestnuts.", prices: { order: 15.70 }, options: riceOptions },
  { id: "chow-steak-kew", number: "142", name: "Chow Steak Kew (Beef)", chineseName: "炒牛球", category: "Chef Specials", description: "Fried beef with mixed vegetables.", prices: { order: 14.40 }, options: riceOptions },
  { id: "lemon-chicken", number: "143", name: "Lemon Chicken", chineseName: "柠檬鸡", category: "Chef Specials", prices: { order: 13.75 }, options: riceOptions },
  { id: "boneless-chicken", number: "144", name: "Boneless Chicken", chineseName: "无骨鸡", category: "Chef Specials", description: "Chicken meat dipped into golden brown with mixed Chinese vegetables.", prices: { order: 13.75 }, options: riceOptions },
  { id: "subgum-wonton", number: "145", name: "Subgum Wonton", chineseName: "什锦云吞", category: "Chef Specials", description: "Crabmeat, shrimp, chicken and roast pork with mixed vegetables, served with fried wonton.", prices: { order: 14.40 }, options: riceOptions },
  { id: "seven-stars-around-moon", number: "146", name: "Seven Stars Around the Moon (For 2)", chineseName: "七星", category: "Chef Specials", description: "Chicken, beef, roast pork, scallops and crabmeat with all season vegetables topped with seven fantail shrimp.", prices: { order: 22.50 }, options: riceOptions },
  { id: "hawaii-delight", number: "147", name: "Hawaii Delight", chineseName: "夏威夷", category: "Chef Specials", description: "Mixed of beef, chicken, jumbo shrimp and roast pork with mixed vegetables in chef's special brown sauce.", prices: { order: 15.20 }, options: riceOptions },
  { id: "chow-gai-kew", number: "148", name: "Chow Gai Kew (Chicken)", chineseName: "炒鸡球", category: "Chef Specials", description: "Breaded white meat chicken with brown sauce and mixed vegetables.", prices: { order: 13.75 }, options: riceOptions },
  { id: "triple-crown", number: "149", name: "Triple Crown", chineseName: "三皇", category: "Chef Specials", description: "Sliced tenderloin of roast pork, beef and chicken sauteed with green and red pepper in a delicate brown spicy sauce.", spicy: true, prices: { order: 15.00 }, options: riceOptions },
  { id: "tai-chien-chicken", number: "150", name: "Tai-Chien Chicken", chineseName: "太千鸡", category: "Chef Specials", description: "Breaded chunks of chicken with mixed vegetables in hot spicy Szechuan sauce.", spicy: true, prices: { order: 13.80 }, options: riceOptions },
  { id: "crispy-orange-beef", number: "151", name: "Crispy Orange Flavor Beef", chineseName: "陈皮牛", category: "Chef Specials", spicy: true, prices: { order: 14.70 }, options: riceOptions },
  { id: "crispy-orange-chicken-chef", number: "151a", name: "Crispy Orange Flavor Chicken", chineseName: "陈皮鸡", category: "Chef Specials", spicy: true, prices: { order: 14.70 }, options: riceOptions },
  { id: "twin-flavor-chicken", number: "152", name: "Twin Flavor Chicken", chineseName: "双味鸡", category: "Chef Specials", description: "Combination of General Tso's chicken and chicken with snow peas.", prices: { order: 16.20 }, options: riceOptions },
  { id: "dragon-phoenix", number: "153", name: "Dragon & Phoenix", chineseName: "龙凤配", category: "Chef Specials", description: "Spicy stir-fried jumbo shrimp and General Tso's chicken.", spicy: true, prices: { order: 16.20 }, options: riceOptions },
  { id: "shrimp-scallop-garlic", number: "154", name: "Shrimp & Scallop in Garlic Sauce", chineseName: "鱼香虾干贝", category: "Chef Specials", spicy: true, prices: { order: 16.20 }, options: riceOptions },
  { id: "mongolian-beef-chicken", number: "155", name: "Mongolian Beef or Chicken", chineseName: "蒙古牛或蒙古鸡", category: "Chef Specials", description: "Snow peas, scallion, onion, sliced green pepper, beef with special spicy sauce.", spicy: true, prices: { order: 14.30 }, options: riceOptions },
  { id: "china-delight-chef", number: "156", name: "China Delight", chineseName: "华乐", category: "Chef Specials", description: "Fresh scallop, chicken, jumbo shrimp, broccoli, dry mushroom in garlic sauce.", spicy: true, prices: { order: 15.70 }, options: riceOptions },
  { id: "coconut-shrimp-or-chicken", number: "158", name: "Coconut Shrimp or Chicken", chineseName: "椰子虾或椰子鸡", category: "Chef Specials", prices: { order: 15.80 }, options: riceOptions },
  { id: "hibachi-chicken", number: "159", name: "Hibachi Chicken", chineseName: "铁板鸡", category: "Chef Specials", prices: { order: 16.80 }, options: riceOptions },

  { id: "diet-mixed-vegetables", number: "D1", name: "Mixed Chinese Vegetables", chineseName: "水煮杂菜", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 9.45, large: 13.95 }, options: riceOptions },
  { id: "diet-chicken-mixed-vegetables", number: "D2", name: "Chicken with Mixed Vegetables", chineseName: "水煮杂菜鸡", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 9.45, large: 13.95 }, options: riceOptions },
  { id: "diet-chicken-broccoli", number: "D3", name: "Chicken with Broccoli", chineseName: "水煮芥兰鸡", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 9.45, large: 13.95 }, options: riceOptions },
  { id: "diet-shrimp-broccoli", number: "D4", name: "Shrimp with Broccoli", chineseName: "水煮芥兰虾", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 9.85, large: 13.95 }, options: riceOptions },
  { id: "diet-buddhist-delight", number: "D5", name: "Buddhist Delight", chineseName: "清蒸罗汉斋", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 9.45, large: 13.95}, options: riceOptions },
  { id: "diet-string-bean", number: "D6", name: "String Bean Chicken or Shrimp", chineseName: "清蒸四季豆鸡或虾", category: "Diet Food / Steamed", description: "With white rice and sauce on the side.", prices: { pint: 8.95, large: 13.95 }, options: riceOptions },

  { id: "lunch-mixed-vegetables", number: "LD1", name: "Mixed Chinese Vegetables", chineseName: "什锦时蔬", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-chicken-mixed-vegetables", number: "LD2", name: "Chicken with Mixed Vegetables", chineseName: "什锦鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-broccoli", number: "LD4", name: "Shrimp with Broccoli", chineseName: "西兰花虾仁", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-broccoli", number: "LD3", name: "Chicken with Broccoli", chineseName: "西兰花鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-string-bean-chicken-shrimp", number: "LD6", name: "String Bean Chicken or Shrimp", chineseName: "四季豆鸡或虾仁", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-tofu-with-mixed-vegetables", number: "LD5", name: "Tofu with Mixed Vegetables", chineseName: "什锦豆腐", category: "Lunch Special", description: "Served with pork fried rice. Choice of wonton soup, egg drop soup, egg roll, or canned soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-shrimp-chow-mein", number: "L1", name: "Shrimp Chow Mein", chineseName: "虾仁炒面", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-chow-mein", number: "L2", name: "Chicken Chow Mein", chineseName: "鸡肉炒面", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-beef-chicken-broccoli", number: "L3", name: "Beef or Chicken with Broccoli", chineseName: "西兰花牛肉或鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-roast-pork-chinese-vegetables", number: "L4", name: "Roast Pork with Chinese Vegetables", chineseName: "叉烧炒时蔬", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-pepper-steak-onion", number: "L5", name: "Pepper Steak with Onion", chineseName: "洋葱青椒牛肉", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-lobster-sauce", number: "L6", name: "Shrimp with Lobster Sauce", chineseName: "龙虾汁虾仁", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-moo-goo-gai-pan", number: "L7", name: "Moo Goo Gai Pan", chineseName: "蘑菇鸡片", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-shrimp-chicken-lo-mein", number: "L8", name: "Shrimp or Chicken Lo Mein", chineseName: "虾仁或鸡肉捞面", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-boneless-spare-ribs", number: "L10", name: "Boneless Spare Ribs", chineseName: "无骨排骨", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-sweet-sour-pork-chicken", number: "L11", name: "Sweet & Sour Pork or Chicken", chineseName: "糖醋肉或糖醋鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-roast-pork-lo-mein", number: "L12", name: "Roast Pork Lo Mein", chineseName: "叉烧捞面", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-roast-pork-broccoli", number: "L13", name: "Roast Pork with Broccoli", chineseName: "西兰花叉烧", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-cashew", number: "L14", name: "Chicken with Cashew Nuts", chineseName: "腰果鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-roast-pork-broccoli", number: "L14a", name: "Chicken or Roast Pork with Broccoli", chineseName: "西兰花鸡或叉烧", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-chicken-beef-szechuan", number: "L15", name: "Chicken or Beef Szechuan Style", chineseName: "四川鸡或牛肉", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-teriyaki-chicken-vegetable", number: "L17", name: "Teriyaki Chicken with Vegetable", chineseName: "照烧鸡时蔬", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-teriyaki-beef-vegetable", number: "L17a", name: "Teriyaki Beef with Vegetable", chineseName: "照烧牛肉时蔬", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-chinese-vegetables", number: "L18", name: "Shrimp with Chinese Vegetables", chineseName: "时蔬虾仁", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 10.25 }, options: lunchOptions },
  { id: "lunch-shrimp-mixed-vegetables", number: "L19", name: "Shrimp with Mixed Vegetables", chineseName: "什锦虾仁", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 10.25 }, options: lunchOptions },
  { id: "lunch-shrimp-broccoli-alt", number: "L21", name: "Shrimp with Broccoli", chineseName: "西兰花虾仁", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-sauteed-mixed-vegetables", number: "L22", name: "Sauteed Mixed Vegetables", chineseName: "炒什锦时蔬", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-beef-snow-peas", number: "L23", name: "Beef with Snow Peas", chineseName: "荷兰豆牛肉", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-roast-pork-mushroom", number: "L26", name: "Roast Pork with Mushroom", chineseName: "蘑菇叉烧", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-sauteed-broccoli", number: "L27", name: "Sauteed Broccoli", chineseName: "炒西兰花", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-sesame-shrimp", number: "L28", name: "Sesame Shrimp", chineseName: "芝麻虾仁", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-sesame-chicken", number: "L29", name: "Sesame Chicken", chineseName: "芝麻鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-chicken-garlic-sauce-l30", number: "L30", name: "Chicken with Garlic Sauce", chineseName: "鱼香鸡", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-general-tsos-shrimp", number: "L31", name: "General Tso's Shrimp", chineseName: "左宗虾", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-beef-garlic-sauce-l32", number: "L32", name: "Beef with Garlic Sauce", chineseName: "鱼香牛肉", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-szechuan-spicy-chicken", number: "L33", name: "Szechuan Spicy Chicken", chineseName: "四川辣鸡", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-szechuan-spicy-beef", number: "L34", name: "Szechuan Spicy Beef", chineseName: "四川辣牛肉", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-general-tsos-chicken", number: "L35", name: "General Tso's Chicken", chineseName: "左宗鸡", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-broccoli-garlic-sauce", number: "L36", name: "Broccoli with Garlic Sauce", chineseName: "鱼香西兰花", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-kung-po-chicken-shrimp", number: "L37", name: "Kung Po Chicken or Shrimp with Peanuts", chineseName: "宫保鸡丁或虾仁", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-eggplant-chicken", number: "L38", name: "Eggplant with Chicken", chineseName: "鱼香茄子鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.45 }, options: lunchOptions },
  { id: "lunch-hunan-beef-chicken", number: "L40", name: "Hunan Beef or Chicken", chineseName: "湖南牛肉或鸡", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-shrimp-garlic-sauce", number: "L41", name: "Shrimp with Garlic Sauce", chineseName: "鱼香虾仁", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-black-pepper-chicken", number: "L42", name: "Black Pepper Chicken", chineseName: "黑椒鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-honey-chicken", number: "L43", name: "Honey Chicken", chineseName: "蜜糖鸡", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-coconut-shrimp", number: "L45", name: "Coconut Shrimp", chineseName: "椰香虾仁", category: "Lunch Special", description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },
  { id: "lunch-szechuan-shrimp", number: "L46", name: "Szechuan Shrimp", chineseName: "四川虾仁", category: "Lunch Special", spicy: true, description: "Served with pork fried rice. Choice of soup or soda.", prices: { order: 9.75 }, options: lunchOptions },

  { id: "fortune-cookies", number: "S1", name: "Fortune Cookies", chineseName: "幸运饼干", category: "Side Orders", prices: { order: 1.75 }, options: regularOptions },
  { id: "fried-noodles", number: "S2", name: "Fried Noodles", chineseName: "炸面", category: "Side Orders", prices: { order: 1.80 }, description: "1 bag.", options: regularOptions },
  { id: "extra-white-rice", number: "S3", name: "Extra White Rice", chineseName: "白饭", category: "Side Orders", prices: { small: 4.20, large: 5.60 }, options: regularOptions },

];

type MenuSplit = { id: string; number: string; name: string; chineseName?: string; description?: string };

const menuItemSplits: Record<string, MenuSplit[]> = {
  "egg-roll": [
    { id: "egg-roll", number: "1A", name: "Egg Roll", chineseName: "蛋卷" },
    { id: "vegetable-egg-roll", number: "1B", name: "Vegetable Egg Roll", chineseName: "菜蛋卷" }
  ],
  "shrimp-roll": [
    { id: "shrimp-roll", number: "2A", name: "Shrimp Roll", chineseName: "虾卷" },
    { id: "spring-roll", number: "2B", name: "Spring Roll", chineseName: "春卷" }
  ],
  "crab-rangoon": [
    { id: "crab-rangoon", number: "6A", name: "Crab Rangoon (10)", chineseName: "蟹角" },
    { id: "cheese-wonton", number: "6B", name: "Cheese Wonton", chineseName: "芝士蟹角" }
  ],
  dumplings: [
    { id: "fried-dumplings", number: "14A", name: "Fried Dumpling (8)", chineseName: "锅贴" },
    { id: "steamed-dumplings", number: "14B", name: "Steamed Dumpling (8)", chineseName: "水饺" }
  ],
  "vegetable-dumplings": [
    { id: "fried-vegetable-dumplings", number: "15A", name: "Fried Vegetable Dumpling (8)", chineseName: "菜贴" },
    { id: "steamed-vegetable-dumplings", number: "15B", name: "Steamed Vegetable Dumpling (8)", chineseName: "菜饺" }
  ],
  "shrimp-egg-foo-young": [
    { id: "shrimp-egg-foo-young", number: "96A", name: "Shrimp Egg Foo Young", chineseName: "虾蓉蛋" },
    { id: "beef-egg-foo-young", number: "96B", name: "Beef Egg Foo Young", chineseName: "牛蓉蛋" }
  ],
  "sauteed-broccoli": [
    { id: "sauteed-broccoli", number: "99A", name: "Sauteed Broccoli", chineseName: "炒芥兰" },
    { id: "buddhist-delight-vegetable", number: "99B", name: "Buddhist Delight", chineseName: "罗汉斋" }
  ],
  "chicken-chow-fun": [
    { id: "chicken-chow-fun", number: "104A", name: "Chicken Chow Fun", chineseName: "鸡河粉" },
    { id: "chicken-mai-fun", number: "104B", name: "Chicken Mai Fun", chineseName: "鸡米粉" }
  ],
  "pork-chow-fun": [
    { id: "pork-chow-fun", number: "105A", name: "Pork Chow Fun", chineseName: "猪河粉" },
    { id: "pork-mai-fun", number: "105B", name: "Pork Mai Fun", chineseName: "猪米粉" }
  ],
  "shrimp-chow-fun": [
    { id: "shrimp-chow-fun", number: "106A", name: "Shrimp Chow Fun", chineseName: "虾河粉" },
    { id: "shrimp-mai-fun", number: "106B", name: "Shrimp Mai Fun", chineseName: "虾米粉" }
  ],
  "singapore-chow-mai-fun": [
    { id: "singapore-chow-fun", number: "107A", name: "Singapore Chow Fun", chineseName: "星洲河粉" },
    { id: "singapore-mai-fun", number: "107B", name: "Singapore Mai Fun", chineseName: "星洲米粉" }
  ],
  "vegetable-chow-fun": [
    { id: "vegetable-chow-fun", number: "107C", name: "Vegetable Chow Fun", chineseName: "菜河粉" },
    { id: "vegetable-mai-fun", number: "107D", name: "Vegetable Mai Fun", chineseName: "菜米粉" }
  ],
  "wings-shrimp-fried-rice": [
    { id: "wings-shrimp-fried-rice", number: "110A", name: "Chicken Wings with Shrimp Fried Rice", chineseName: "鸡翅虾炒饭" },
    { id: "wings-beef-fried-rice", number: "110B", name: "Chicken Wings with Beef Fried Rice", chineseName: "鸡翅牛炒饭" }
  ],
  "moo-shu-pork-chicken": [
    { id: "moo-shu-pork", number: "112A", name: "Moo Shu Pork", chineseName: "木须肉" },
    { id: "moo-shu-chicken", number: "112B", name: "Moo Shu Chicken", chineseName: "木须鸡" }
  ],
  "moo-shu-shrimp-beef": [
    { id: "moo-shu-shrimp", number: "113A", name: "Moo Shu Shrimp", chineseName: "木须虾" },
    { id: "moo-shu-beef", number: "113B", name: "Moo Shu Beef", chineseName: "木须牛" }
  ],
  "combo-bbq-ribs": [
    { id: "combo-bbq-ribs", number: "C1A", name: "Bar-B-Q Spare Ribs", chineseName: "排骨" },
    { id: "combo-boneless-spare-ribs", number: "C1B", name: "Boneless Spare Ribs", chineseName: "无骨排" }
  ],
  "combo-chicken-garlic-pork": [
    { id: "combo-chicken-garlic-sauce", number: "C7A", name: "Chicken with Garlic Sauce", chineseName: "鱼香鸡" },
    { id: "combo-pork-garlic-sauce", number: "C7B", name: "Pork with Garlic Sauce", chineseName: "鱼香叉烧" }
  ],
  "combo-shrimp-garlic-beef": [
    { id: "combo-shrimp-garlic-sauce", number: "C8A", name: "Shrimp with Garlic Sauce", chineseName: "鱼香虾" },
    { id: "combo-beef-garlic-sauce", number: "C8B", name: "Beef with Garlic Sauce", chineseName: "鱼香牛" }
  ],
  "combo-hunan-beef-chicken": [
    { id: "combo-hunan-beef", number: "C10A", name: "Hunan Beef", chineseName: "湖南牛" },
    { id: "combo-hunan-chicken", number: "C10B", name: "Hunan Chicken", chineseName: "湖南鸡" }
  ],
  "combo-string-beans-garlic": [
    { id: "combo-string-beans-chicken-garlic", number: "C12A", name: "String Beans with Chicken in Garlic Sauce", chineseName: "鱼香四季豆鸡" },
    { id: "combo-string-beans-shrimp-garlic", number: "C12B", name: "String Beans with Shrimp in Garlic Sauce", chineseName: "鱼香四季豆虾" }
  ],
  "combo-eggplant-garlic": [
    { id: "combo-eggplant-chicken-garlic", number: "C14A", name: "Eggplant with Chicken in Garlic Sauce", chineseName: "鱼香茄子鸡" },
    { id: "combo-eggplant-shrimp-garlic", number: "C14B", name: "Eggplant with Shrimp in Garlic Sauce", chineseName: "鱼香茄子虾" }
  ],
  "mongolian-beef-chicken": [
    { id: "mongolian-beef", number: "155A", name: "Mongolian Beef", chineseName: "蒙古牛" },
    { id: "mongolian-chicken", number: "155B", name: "Mongolian Chicken", chineseName: "蒙古鸡" }
  ],
  "coconut-shrimp-or-chicken": [
    { id: "coconut-shrimp-chef", number: "158A", name: "Coconut Shrimp", chineseName: "椰香虾" },
    { id: "coconut-chicken-chef", number: "158B", name: "Coconut Chicken", chineseName: "椰香鸡" }
  ],
  "diet-string-bean": [
    { id: "diet-string-bean-chicken", number: "D6A", name: "String Bean Chicken", chineseName: "清蒸四季豆鸡" },
    { id: "diet-string-bean-shrimp", number: "D6B", name: "String Bean Shrimp", chineseName: "清蒸四季豆虾" }
  ],
  "lunch-string-bean-chicken-shrimp": [
    { id: "lunch-string-bean-chicken", number: "LD5A", name: "String Bean Chicken", chineseName: "四季豆鸡" },
    { id: "lunch-string-bean-shrimp", number: "LD5B", name: "String Bean Shrimp", chineseName: "四季豆虾" }
  ],
  "lunch-beef-chicken-broccoli": [
    { id: "lunch-beef-broccoli", number: "L3A", name: "Beef with Broccoli", chineseName: "芥兰牛" },
    { id: "lunch-chicken-broccoli-l3", number: "L3B", name: "Chicken with Broccoli", chineseName: "西兰花鸡" }
  ],
  "lunch-shrimp-chicken-lo-mein": [
    { id: "lunch-shrimp-lo-mein", number: "L8A", name: "Shrimp Lo Mein", chineseName: "虾仁捞面" },
    { id: "lunch-chicken-lo-mein", number: "L8B", name: "Chicken Lo Mein", chineseName: "鸡肉捞面" }
  ],
  "lunch-sweet-sour-pork-chicken": [
    { id: "lunch-sweet-sour-pork", number: "L11A", name: "Sweet & Sour Pork", chineseName: "糖醋肉" },
    { id: "lunch-sweet-sour-chicken", number: "L11B", name: "Sweet & Sour Chicken", chineseName: "糖醋鸡" }
  ],
  "lunch-chicken-roast-pork-broccoli": [
    { id: "lunch-chicken-broccoli-l14a", number: "L14A", name: "Chicken with Broccoli", chineseName: "西兰花鸡" },
    { id: "lunch-roast-pork-broccoli-l14a", number: "L14B", name: "Roast Pork with Broccoli", chineseName: "西兰花叉烧" }
  ],
  "lunch-chicken-beef-szechuan": [
    { id: "lunch-chicken-szechuan", number: "L15A", name: "Chicken Szechuan Style", chineseName: "四川鸡" },
    { id: "lunch-beef-szechuan", number: "L15B", name: "Beef Szechuan Style", chineseName: "四川牛肉" }
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

// Master switch for the entire Lunch Special section. Set to false to hide all Lunch
// Special items from customers (menu, order page, search, category filters) and to block
// them from being ordered: when disabled they are excluded from `menuItems`, so the
// checkout server can't find them when repricing and rejects the line.
//
// The raw lunch data stays untouched in `rawMenuItems`/`menuItemSplits` above, so lunch can
// be turned back on later by flipping this to true. Past orders are unaffected because they
// store their own item snapshots in `order_items` (used by admin display, kitchen tickets,
// and the daily report) rather than reading from `menuItems`.
export const LUNCH_SPECIALS_ENABLED = false;

export const menuItems: MenuItem[] = applyMenuSplits(rawMenuItems)
  .filter((item) => LUNCH_SPECIALS_ENABLED || item.category !== "Lunch Special")
  .map((item) => ({
    ...item,
    options: {
      ...item.options,
      lunchChoices: item.category === "Lunch Special" ? true : item.options?.lunchChoices,
      comboIncluded: item.category === "Special Combination Platters" ? true : item.options?.comboIncluded
    }
  }));

export const menuCategories: MenuCategory[] = printedMenuCategories.filter((category) => menuItems.some((item) => item.category === category));

