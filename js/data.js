// My Market v1 — DEMO DATA.
// Shop names, numbers and stock are fictional. Market locations are around
// Karol Bagh, New Delhi (the pilot area). Shape mirrors what the real
// backend API will return, so api.js can later swap this for fetch() calls.

window.MM_DATA = (function () {
  // Small seeded random so the demo data is the same on every load.
  let seed = 20261101;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  const CATEGORIES = {
    // Muted, warm category colours: `color` for text/dots, `tint` for soft backgrounds.
    mobile:      { name: "Mobile & Accessories", icon: "📱", color: "#6E5FA0", tint: "#ECE8F5" },
    electronics: { name: "Electronics",          icon: "💻", color: "#3B739C", tint: "#E3EDF5" },
    electrical:  { name: "Electrical",           icon: "⚡", color: "#B87818", tint: "#FAEED6" },
    hardware:    { name: "Hardware & Tools",     icon: "🔧", color: "#7A6450", tint: "#F0E8DE" },
    plumbing:    { name: "Plumbing & Sanitary",  icon: "🚿", color: "#2A7F7C", tint: "#DFF0EC" },
    clothes:     { name: "Clothes",              icon: "👕", color: "#B4506F", tint: "#F8E5EA" },
    footwear:    { name: "Footwear",             icon: "👟", color: "#8E5487", tint: "#F3E5EF" },
    kitchen:     { name: "Kitchenware",          icon: "🍳", color: "#5A8644", tint: "#E8F0DF" },
  };

  // [name, brand, typical price ₹]
  const CATALOG = {
    mobile: [
      ["Type-C Fast Charger 25W", "Samsung", 899], ["Type-C Cable 1 m", "boAt", 299],
      ["Lightning Cable (iPhone)", "Generic", 349], ["Tempered Glass (all models)", "Generic", 150],
      ["Mobile Back Cover", "Generic", 199], ["Wired Earphones", "boAt", 449],
      ["Power Bank 10000 mAh", "Mi", 1299], ["Phone Battery Replacement", "Service", 999],
      ["Screen Replacement", "Service", 2499], ["OTG Adapter Type-C", "Generic", 99],
      ["Bluetooth Neckband", "boAt", 1199], ["Car Mobile Holder", "Generic", 349],
    ],
    electronics: [
      ["HDMI Cable 1.5 m", "Generic", 249], ["Pendrive 64GB", "SanDisk", 549],
      ["Wireless Mouse", "Logitech", 699], ["USB Keyboard", "Dell", 599],
      ["Wi-Fi Router", "TP-Link", 1499], ["CCTV Camera 2MP", "CP Plus", 1899],
      ["Universal Laptop Charger", "Generic", 1199], ["TV Remote Control", "Generic", 199],
      ["Arduino Uno Board", "Generic", 649], ["Soldering Iron 25W", "Soldron", 349],
      ["Memory Card 32GB", "SanDisk", 399], ["Extension USB Hub 4-port", "Generic", 299],
    ],
    electrical: [
      ["MCB 32A Single Pole", "Havells", 289], ["Modular Switch 6A", "Anchor Roma", 45],
      ["FR Wire 1.5 sq mm (90 m)", "Polycab", 1650], ["LED Bulb 9W", "Philips", 99],
      ["LED Batten 20W", "Syska", 299], ["Extension Board 4-socket", "Anchor", 449],
      ["Ceiling Fan 1200 mm", "Crompton", 1899], ["Wire 2.5 sq mm (90 m)", "Finolex", 2450],
      ["Insulation Tape", "Anchor", 25], ["Storage Geyser 15 L", "Havells", 7999],
      ["Electric Plug Top 16A", "Anchor", 89], ["Doorbell", "Anchor", 249],
    ],
    hardware: [
      ["Screwdriver Set", "Taparia", 449], ["Drill Machine 13 mm", "Bosch", 3299],
      ["Adhesive SH 1 kg", "Fevicol", 399], ["Wall Plugs + Screws Pack", "Generic", 99],
      ["Pad Lock", "Godrej", 349], ["Door Hinge 4 inch (pair)", "Generic", 120],
      ["Wall Primer 1 L", "Asian Paints", 299], ["Measuring Tape 5 m", "Freemans", 199],
      ["Hacksaw Blade", "Generic", 40], ["M-Seal 100 g", "Pidilite", 65],
      ["Spanner Set", "Taparia", 799], ["Sandpaper Sheet", "Generic", 15],
    ],
    plumbing: [
      ["CPVC Elbow 1 inch", "Ashirvad", 38], ["PVC Pipe 1 inch (3 m)", "Supreme", 260],
      ["Brass Ball Valve 1 inch", "Generic", 349], ["Bib Tap", "Jaquar", 899],
      ["Teflon Tape", "Generic", 15], ["Geyser Connection Pipe 18 inch", "Generic", 180],
      ["Health Faucet Set", "Cera", 699], ["CPVC Pipe 3/4 inch (3 m)", "Astral", 320],
      ["Tank Float Valve", "Generic", 249], ["PVC Solvent Cement", "Astral", 120],
      ["Wash Basin Waste Pipe", "Generic", 150], ["Shower Head", "Jaquar", 1199],
    ],
    clothes: [
      ["Men's Formal Shirt", "Peter England", 1299], ["Men's Jeans", "Levi's", 1999],
      ["Cotton Kurti", "Generic", 599], ["Silk Blend Saree", "Generic", 2499],
      ["Kids T-shirt", "Generic", 299], ["Lehenga", "Generic", 6999],
      ["Winter Jacket", "Generic", 1799], ["Track Pants", "Generic", 499],
      ["Dupatta", "Generic", 349], ["School Uniform Set", "Generic", 899],
    ],
    footwear: [
      ["Sports Shoes", "Campus", 1499], ["Formal Leather Shoes", "Red Chief", 2499],
      ["Chappal / Slippers", "Relaxo", 199], ["Ladies Sandals", "Generic", 699],
      ["Kids Shoes", "Generic", 599], ["Canvas Shoes", "Bata", 899],
      ["Punjabi Jutti", "Generic", 799], ["Shoe Polish", "Cherry", 60], ["Socks (3 pairs)", "Generic", 199],
    ],
    kitchen: [
      ["Pressure Cooker 5 L", "Prestige", 1899], ["Non-stick Tawa", "Hawkins", 799],
      ["Steel Utensil Set", "Generic", 1499], ["Mixer Grinder Jar", "Generic", 549],
      ["Gas Stove Pipe 1.5 m", "Suraksha", 249], ["Kitchen Knife Set", "Generic", 299],
      ["Steel Water Bottle 1 L", "Milton", 449], ["Lunch Box", "Milton", 399],
    ],
  };

  // Pilot area: Karol Bagh, New Delhi.
  const MARKETS = [
    { id: "gaffar", name: "Gaffar Market", area: "Karol Bagh", lat: 28.6519, lng: 77.1907,
      tagline: "Mobiles, accessories & electronics" },
    { id: "ajmal", name: "Ajmal Khan Road", area: "Karol Bagh", lat: 28.6487, lng: 77.1923,
      tagline: "Clothes, footwear & household" },
    { id: "beadon", name: "Beadonpura Hardware Bazaar", area: "Karol Bagh", lat: 28.6547, lng: 77.1876,
      tagline: "Hardware, plumbing & electrical" },
  ];

  // [market, category, shop name, landmark hint]
  const SHOPS_RAW = [
    ["gaffar", "mobile", "Sharma Mobile Point", "Opposite the main Gaffar Market gate"],
    ["gaffar", "mobile", "Raj Mobile Repair", "Lane 2, next to the tea stall"],
    ["gaffar", "mobile", "Singh Accessories", "Corner shop facing the parking"],
    ["gaffar", "mobile", "New Delhi Telecom", "Lane 3, blue signboard"],
    ["gaffar", "electronics", "Gupta Electronics", "Behind the ATM, first floor"],
    ["gaffar", "electronics", "Techno Hub", "Lane 1, near the temple"],
    ["gaffar", "electronics", "Chip & Circuit", "Basement, take the stairs by the lift"],
    ["gaffar", "electrical", "Bright Electricals", "End of Lane 2"],
    ["ajmal", "clothes", "Kapoor Garments", "Near the Ajmal Khan Road crossing"],
    ["ajmal", "clothes", "Fashion Junction", "Opposite the juice corner"],
    ["ajmal", "clothes", "Rani Saree Centre", "First floor, above the sweet shop"],
    ["ajmal", "clothes", "Little Stars Kidswear", "Next to the bank"],
    ["ajmal", "footwear", "Step Up Footwear", "Middle of the road, green awning"],
    ["ajmal", "footwear", "Mehra Shoe House", "Corner of the side lane"],
    ["ajmal", "kitchen", "Annapurna Kitchenware", "Opposite the pharmacy"],
    ["ajmal", "kitchen", "Steel Palace", "Two shops after the bus stop"],
    ["beadon", "hardware", "Bansal Hardware", "Entrance of the bazaar, left side"],
    ["beadon", "hardware", "Aggarwal Tools", "Lane 1, yellow shutter"],
    ["beadon", "hardware", "Shiv Hardware & Paints", "Near the Shiv temple"],
    ["beadon", "plumbing", "Jal Plumbing Store", "Lane 2, pipes stacked outside"],
    ["beadon", "plumbing", "Aqua Sanitary", "Opposite Bansal Hardware"],
    ["beadon", "plumbing", "Goyal Pipe House", "End of Lane 2, godown behind"],
    ["beadon", "electrical", "Jyoti Electricals", "Lane 1, next to Aggarwal Tools"],
    ["beadon", "electrical", "Power Line Electric", "First floor, stairs by the chai stall"],
  ];

  const DAY = 86400000;
  const now = Date.now();

  const shops = SHOPS_RAW.map(([mId, cat, name, landmark], i) => {
    const m = MARKETS.find((x) => x.id === mId);
    const lat = m.lat + (rnd() - 0.5) * 0.0016;
    const lng = m.lng + (rnd() - 0.5) * 0.0016;
    const tmpl = CATALOG[cat];
    const count = 6 + Math.floor(rnd() * 5);
    const chosen = [...tmpl].sort(() => rnd() - 0.5).slice(0, Math.min(count, tmpl.length));
    const showPrices = rnd() > 0.3;
    const items = chosen.map(([iname, brand, price], j) => {
      const confirmed = rnd() < 0.65;
      return {
        id: `s${i + 1}-i${j + 1}`,
        name: iname,
        brand,
        cat,
        price: showPrices ? Math.round((price * (0.9 + rnd() * 0.2)) / 5) * 5 : null,
        // confirmed = someone (shop, field agent or customer) said it's in stock recently
        lastConfirmed: confirmed ? now - Math.floor(rnd() * 10) * DAY - Math.floor(rnd() * 20) * 3600000 : null,
      };
    });
    const floor = /first floor/i.test(landmark) ? "1st floor" : /basement/i.test(landmark) ? "Basement" : "Ground floor";
    const openH = pick([9, 10, 10, 11]);
    return {
      id: `s${i + 1}`,
      marketId: mId,
      name,
      cat,
      cats: [cat],
      shopNo: `${pick(["A", "B", "C", "D"])}-${10 + Math.floor(rnd() * 90)}`,
      floor,
      landmark,
      lat, lng,
      open: openH, close: pick([20, 20, 21, 22]),
      closedDay: pick(["Monday", "Monday", "Tuesday", "None"]),
      phone: `+91 90000 ${String(10000 + i).slice(-5)}`, // fake numbers
      rating: Math.round((3.6 + rnd() * 1.3) * 10) / 10,
      ratings: 20 + Math.floor(rnd() * 400),
      verified: rnd() > 0.35,
      trust: 0.6 + rnd() * 0.35, // 0..1, grows with "found it" feedback
      items,
    };
  });

  return { CATEGORIES, CATALOG, MARKETS, shops, PILOT: { name: "Karol Bagh, New Delhi", lat: 28.6517, lng: 77.1905 } };
})();
