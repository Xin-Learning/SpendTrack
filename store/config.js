/*
 * STORE SETTINGS & MENU
 * ---------------------
 * This is the only file you need to edit to run your store.
 * Prices are in RM. Save the file and refresh the page to see changes.
 */
window.STORE = {
  name: "Your Store",
  title: "Place your order",   // big heading at the top of the page
  logo: "🍱",                   // an emoji, or an image path like "icons/logo.png"
  theme: "dark",                // "dark", "light" or "auto" (follows the customer's phone)
  accent: "#0E9F6E",            // button colour

  // Orders are sent to this WhatsApp number. Country code + number, digits only.
  // e.g. "60123456789" for 012-345 6789. Leave empty to test without sending.
  whatsapp: "",

  address: "Lot 1, Jalan Contoh, 88000 Kota Kinabalu, Sabah",
  mapsUrl: "https://maps.google.com/?q=Kota+Kinabalu",
  notice: "",                   // optional banner, e.g. "Closed 1–3 Oct for Raya 🎉"

  // Opening hours ("HH:MM", 24-hour). Use null for days you're closed.
  hours: {
    mon: ["10:00", "21:00"],
    tue: ["10:00", "21:00"],
    wed: ["10:00", "21:00"],
    thu: ["10:00", "21:00"],
    fri: ["10:00", "21:00"],
    sat: ["09:00", "22:00"],
    sun: null
  },
  closedDates: [],              // extra days off, e.g. ["2026-12-25", "2027-01-01"]
  slotMinutes: 30,              // gap between pickup/delivery times
  leadMinutes: 45,              // earliest time a customer can choose, from now
  daysAhead: 7,                 // how many days ahead customers can order

  pickup: {
    enabled: true,
    minOrder: 0
  },
  delivery: {
    enabled: true,
    fee: 5,
    freeAbove: 60,              // free delivery at or above this subtotal (0 = never free)
    minOrder: 25,
    note: "Within 10 km of our shop"
  },

  // Payment options the customer can choose. Remove all to skip this question.
  payments: [
    { id: "transfer", label: "Online transfer / DuitNow QR", details: "We'll send our bank details on WhatsApp after confirming your order." },
    { id: "cash", label: "Cash on pickup / delivery" }
  ],

  categories: [
    { id: "mains", name: "Rice & Noodles" },
    { id: "snacks", name: "Snacks" },
    { id: "desserts", name: "Desserts" },
    { id: "drinks", name: "Drinks" }
  ],

  /*
   * MENU ITEMS (sample — replace with your own)
   *   id          unique, no spaces
   *   category    one of the category ids above
   *   emoji/image shown as the picture; image wins if both are set ("images/nasi-lemak.jpg")
   *   tags        little labels like "Best seller" or "Spicy"
   *   soldOut     true to show the item but stop orders
   *   options     choices the customer picks. required: must pick one.
   *               max: how many they can pick (default 1). price: extra cost.
   */
  items: [
    {
      id: "nasi-lemak",
      category: "mains",
      name: "Nasi Lemak Ayam Goreng",
      description: "Coconut rice, crispy fried chicken, house sambal, egg, peanuts and anchovies.",
      price: 12.9,
      emoji: "🍛",
      tags: ["Best seller"],
      options: [
        { name: "Add-ons", max: 3, choices: [
          { name: "Extra egg", price: 1.5 },
          { name: "Extra sambal", price: 1 },
          { name: "Extra rice", price: 1.5 }
        ] }
      ]
    },
    {
      id: "mee-goreng",
      category: "mains",
      name: "Mee Goreng Mamak",
      description: "Wok-fried yellow noodles with tofu, potato, egg and a squeeze of lime.",
      price: 9.9,
      emoji: "🍜",
      options: [
        { name: "Spice level", required: true, choices: [
          { name: "Mild" }, { name: "Medium" }, { name: "Extra spicy" }
        ] }
      ]
    },
    {
      id: "nasi-goreng",
      category: "mains",
      name: "Nasi Goreng Kampung",
      description: "Village-style fried rice with anchovies, kangkung and a fried egg.",
      price: 10.9,
      emoji: "🍳"
    },
    {
      id: "chicken-chop",
      category: "mains",
      name: "Chicken Chop",
      description: "Grilled chicken thigh with fries, coleslaw and your choice of sauce.",
      price: 15.9,
      emoji: "🍗",
      options: [
        { name: "Sauce", required: true, choices: [
          { name: "Black pepper" }, { name: "Mushroom" }
        ] }
      ]
    },
    {
      id: "curry-puff",
      category: "snacks",
      name: "Curry Puff (3 pcs)",
      description: "Flaky pastry with spiced potato and chicken filling.",
      price: 4.5,
      emoji: "🥟",
      tags: ["Best seller"]
    },
    {
      id: "popiah",
      category: "snacks",
      name: "Popiah Basah",
      description: "Fresh spring rolls with jicama, egg and sweet sauce.",
      price: 5.5,
      emoji: "🌯"
    },
    {
      id: "keropok-lekor",
      category: "snacks",
      name: "Keropok Lekor",
      description: "Chewy fish crackers with chilli dip.",
      price: 6,
      emoji: "🍢",
      soldOut: true
    },
    {
      id: "cendol",
      category: "desserts",
      name: "Cendol",
      description: "Shaved ice, pandan jelly, coconut milk and gula Melaka.",
      price: 6.5,
      emoji: "🍧",
      options: [
        { name: "Toppings", max: 2, choices: [
          { name: "Durian", price: 3 },
          { name: "Red bean", price: 1 }
        ] }
      ]
    },
    {
      id: "kuih",
      category: "desserts",
      name: "Kuih Platter",
      description: "Six assorted traditional kuih, made fresh each morning.",
      price: 8,
      emoji: "🍡"
    },
    {
      id: "teh-tarik",
      category: "drinks",
      name: "Teh Tarik",
      description: "Pulled milk tea.",
      price: 3.5,
      emoji: "🧋",
      options: [
        { name: "Temperature", required: true, choices: [
          { name: "Hot" }, { name: "Iced", price: 0.5 }
        ] },
        { name: "Sugar", required: true, choices: [
          { name: "Normal" }, { name: "Less sweet" }, { name: "No sugar" }
        ] }
      ]
    },
    {
      id: "kopi-o",
      category: "drinks",
      name: "Kopi O",
      description: "Local black coffee.",
      price: 3,
      emoji: "☕",
      options: [
        { name: "Temperature", required: true, choices: [
          { name: "Hot" }, { name: "Iced", price: 0.5 }
        ] }
      ]
    },
    {
      id: "lemon-tea",
      category: "drinks",
      name: "Iced Lemon Tea",
      description: "Freshly brewed, with real lemon.",
      price: 4.5,
      emoji: "🍋"
    },
    {
      id: "water",
      category: "drinks",
      name: "Mineral Water",
      description: "500 ml bottle.",
      price: 1.5,
      emoji: "💧"
    }
  ]
};
