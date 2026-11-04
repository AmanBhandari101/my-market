// My Market — more products for "Add items" (common items in Indian shops).
// Each: [name, brand]. Names say what shopkeepers and customers call them;
// Hindi / Hinglish names in brackets help search. Prices are set by each shop.
(function () {
  const D = window.MM_DATA; if (!D || !D.CATALOG) return;
  const G = "Generic";
  const MORE = {
    hardware: [
      "Claw Hammer 500 g (Hathoda)", "Ball Pein Hammer", "Combination Plier 8 inch (Plas)", "Nose Plier", "Cutting Plier", "Adjustable Wrench 10 inch",
      "Pipe Wrench 14 inch", "Allen Key Set", "Screwdriver 2-in-1", "Line Tester", "Chisel (Chheni)", "Wood Saw (Aari)", "Hacksaw Frame",
      "Spirit Level 12 inch", "Trowel (Karni)", "Putty Knife", "Paint Brush 2 inch", "Paint Brush 4 inch", "Paint Roller 9 inch", "Wall Putty 5 kg",
      "Emulsion Paint 1 L", "Enamel Paint 1 L", "Thinner 1 L", "Cement 50 kg bag", "White Cement 1 kg", "Tile Adhesive 20 kg", "Tile Grout 1 kg",
      "Nails 2 inch (1 kg)", "Nails 3 inch (1 kg)", "Wood Screws Box", "Nut Bolt Set", "Washers Pack", "Anchor Fastener 10 mm", "Door Handle",
      "Tower Bolt 6 inch", "Door Stopper", "Door Closer", "Mortise Lock", "Cupboard Lock", "Drawer Channel 18 inch", "Cabinet Hinge (Auto)",
      "Curtain Bracket (pair)", "Curtain Rod 5 ft", "Window Hook / Aldrop", "Chain 1 m", "Wire Rope 1 m", "Nylon Rope 10 m (Rassi)", "Tarpaulin 12x15 ft",
      "Gloves (pair)", "Safety Goggles", "Dust Mask", "Ladder 6 ft", "Wheelbarrow", "Shovel (Phawda)", "Pickaxe (Gaiti)", "Drill Bit Set",
      "Masonry Drill Bit 8 mm", "Angle Grinder 4 inch", "Cutting Wheel 4 inch", "Grinding Wheel 4 inch", "Glue Gun", "Glue Sticks (10)",
      "Fevikwik", "Araldite", "Silicone Sealant Gun", "Silicone Sealant", "Wood Polish 1 L", "Varnish 1 L", "Steel Wool", "Weighing Scale 50 kg",
    ].map((n) => [n, /Fevikwik/.test(n) ? "Pidilite" : /Araldite/.test(n) ? "Araldite" : G]),
    electrical: [
      "LED Bulb 12W", "LED Bulb 15W", "LED Bulb 20W", "LED Tube Light 20W", "LED Panel Light 12W", "LED Strip Light 5 m", "Night Bulb 0.5W",
      "Emergency Light", "Rechargeable Torch", "Bulb Holder", "Batten Holder", "Modular Switch 16A", "Modular Socket 6A", "Modular Socket 16A",
      "Switch Board 4 Module", "Switch Board 8 Module", "Fan Regulator", "Ceiling Rose", "Two Pin Plug", "Three Pin Plug 6A", "Multi Plug Adapter",
      "Extension Board 6-socket", "Spike Guard", "MCB 16A", "MCB 6A", "MCB Box (DB) 4-way", "RCCB 40A", "Main Switch 32A", "Kitkat Fuse 32A",
      "Wire 1 sq mm (90 m)", "Wire 4 sq mm (90 m)", "Flexible Wire 0.75 sq mm (1 m)", "Twin Flat Cable", "PVC Conduit Pipe 20 mm (3 m)",
      "Conduit Bend 20 mm", "Junction Box", "Concealed Box 4 Module", "Cable Clips (100)", "Cable Ties Pack", "Earthing Wire", "Wall Fan",
      "Table Fan", "Exhaust Fan 6 inch", "Fan Capacitor 2.5 mfd", "Ceiling Fan Down Rod", "Immersion Rod 1500W", "Electric Iron", "Room Heater",
      "Voltage Stabilizer", "Inverter Battery 150 Ah", "Inverter 900 VA", "Doorbell Wireless", "Electric Kettle", "Multimeter", "Battery AA (pack of 4)",
      "Battery AAA (pack of 4)", "9V Battery", "Cell CR2032", "Solar Light",
    ].map((n) => [n, G]),
    plumbing: [
      "PVC Pipe 1/2 inch (3 m)", "PVC Pipe 3/4 inch (3 m)", "PVC Pipe 4 inch (3 m)", "CPVC Pipe 1/2 inch (3 m)", "CPVC Pipe 1 inch (3 m)", "GI Pipe 1/2 inch (6 m)",
      "PVC Elbow 1/2 inch", "PVC Tee 1/2 inch", "PVC Socket 1/2 inch", "CPVC Tee 3/4 inch", "CPVC Elbow 1/2 inch", "Union 1 inch", "Reducer 1 inch to 3/4 inch",
      "End Cap 1/2 inch", "MTA 1/2 inch", "FTA 1/2 inch", "Gate Valve 1 inch", "Angle Valve (Angle Cock)", "Pillar Tap", "Sink Tap", "Wall Mixer",
      "Tap (Tonti)", "Concealed Stop Cock", "Shower Arm", "Hand Shower", "Flexible Connection Pipe 24 inch", "Sink Waste Coupling", "Nahani Trap",
      "Floor Drain Jali", "P Trap", "Bottle Trap", "Wash Basin", "Kitchen Sink Steel", "Western Toilet (EWC)", "Indian Toilet Pan", "Flush Tank",
      "Toilet Seat Cover", "Seat Cover Hinges", "Flush Valve", "Water Tank 500 L", "Water Tank 1000 L", "Overhead Tank Float Ball", "Water Pump 0.5 HP",
      "Water Level Controller", "Garden Hose 15 m", "Hose Clip", "Water Filter Cartridge", "Plumber Thread (Sutli)", "PVC Solvent 100 ml", "CPVC Solvent 100 ml",
      "Drain Cleaner", "Toilet Cleaner Brush", "Plunger",
    ].map((n) => [n, G]),
    grocery: [
      "Atta 5 kg", "Atta 10 kg", "Basmati Rice 5 kg", "Rice 1 kg", "Sugar 1 kg", "Salt 1 kg", "Toor Dal 1 kg", "Moong Dal 1 kg", "Chana Dal 1 kg",
      "Masoor Dal 1 kg", "Urad Dal 1 kg", "Rajma 1 kg", "Kabuli Chana 1 kg", "Besan 1 kg", "Maida 1 kg", "Suji (Rava) 1 kg", "Poha 1 kg",
      "Mustard Oil 1 L", "Refined Oil 1 L", "Sunflower Oil 1 L", "Desi Ghee 1 L", "Butter 100 g", "Paneer 200 g", "Milk 500 ml", "Curd 400 g",
      "Bread", "Eggs (6)", "Tea 250 g", "Coffee 50 g", "Turmeric Powder 100 g (Haldi)", "Red Chilli Powder 100 g", "Coriander Powder 100 g (Dhaniya)",
      "Garam Masala 100 g", "Jeera 100 g", "Rai / Mustard Seeds 100 g", "Hing", "Biscuits", "Namkeen 200 g", "Instant Noodles", "Pasta 500 g",
      "Ketchup 500 g", "Jam 500 g", "Honey 250 g", "Pickle 500 g (Achar)", "Papad", "Soya Chunks 200 g", "Peanuts 500 g", "Cashew 250 g (Kaju)",
      "Almonds 250 g (Badam)", "Raisins 250 g (Kishmish)", "Jaggery 1 kg (Gur)", "Detergent Powder 1 kg", "Detergent Bar", "Liquid Detergent 1 L",
      "Bath Soap", "Shampoo Sachet", "Shampoo 180 ml", "Toothpaste 150 g", "Toothbrush", "Hair Oil 200 ml", "Dishwash Bar", "Dishwash Liquid 500 ml",
      "Floor Cleaner 1 L", "Toilet Cleaner 500 ml", "Phenyl 1 L", "Agarbatti", "Matchbox", "Candles", "Mosquito Coil", "Garbage Bags",
      "Soft Drink 750 ml", "Mineral Water 1 L", "Juice 1 L", "Chocolate", "Cooking Gas Lighter",
    ].map((n) => [n, G]),
    pharmacy: [
      "Paracetamol 500 mg (strip)", "Paracetamol 650 mg (strip)", "Cough Syrup 100 ml", "Antacid Syrup 200 ml", "ORS Sachet", "Glucose Powder 500 g",
      "Vitamin C Tablets", "Multivitamin Tablets", "Calcium Tablets", "Antiseptic Liquid 500 ml", "Antiseptic Cream", "Pain Relief Spray", "Pain Relief Balm",
      "Pain Relief Gel", "Bandage Roll", "Adhesive Bandage Strips", "Cotton Roll 100 g", "Surgical Tape", "Crepe Bandage", "Gauze Swabs",
      "Thermometer Digital", "BP Monitor", "Glucometer", "Glucometer Strips (50)", "Pulse Oximeter", "Nebulizer", "Hot Water Bag", "Face Mask (pack)",
      "Hand Sanitizer 500 ml", "Hand Wash 200 ml", "Gloves Disposable (100)", "Sanitary Pads", "Baby Diapers", "Baby Powder", "Baby Oil", "Baby Wipes",
      "Moisturising Cream", "Sunscreen", "Petroleum Jelly", "Lip Balm", "Eye Drops", "Ear Drops", "Nasal Spray", "Inhaler", "Steam Inhaler Capsules",
      "Digestive Tablets", "Isabgol 100 g", "Protein Powder", "Knee Cap", "Back Support Belt", "Walking Stick", "Adult Diapers", "Syringe 5 ml",
      "Pregnancy Test Kit", "Condoms",
    ].map((n) => [n, G]),
    stationery: [
      "Notebook 172 pages", "Long Notebook", "Register 200 pages", "A4 Paper Ream 500", "Graph Paper", "Chart Paper", "Drawing Book", "Ball Pen (pack of 5)",
      "Gel Pen", "Blue Pen", "Black Pen", "Pencil (pack of 10)", "Eraser", "Sharpener", "Geometry Box", "Scale 30 cm", "Marker Permanent",
      "Whiteboard Marker", "Highlighter", "Sketch Pens (12)", "Crayons", "Water Colours", "Colour Pencils (12)", "Glue Stick", "Fevicol 100 g",
      "Scissors", "Stapler", "Stapler Pins", "Punching Machine", "Cello Tape", "Brown Tape", "Double Sided Tape", "File Folder", "Clip File",
      "Envelope (pack)", "Sticky Notes", "Calculator", "Exam Pad", "School Bag", "Lunch Bag", "Water Bottle", "Pencil Box", "Book Cover Roll",
      "Name Labels", "Rubber Stamp Pad", "Visiting Cards (100)", "Photocopy (per page)", "Print (per page)", "Lamination (per page)", "Spiral Binding",
    ].map((n) => [n, G]),
    mobile: [
      "Type-C Cable 2 m", "Micro USB Cable", "Charger 10W", "Charger 33W", "Car Charger", "Earphones Type-C", "Bluetooth Earbuds", "Bluetooth Speaker",
      "Smart Watch", "Selfie Stick", "Tripod Mobile Stand", "Ring Light", "Memory Card 64GB", "Pendrive 32GB", "Phone Pouch", "Flip Cover",
      "Camera Lens Protector", "Privacy Tempered Glass", "SIM Ejector Pin", "Charging Port Repair", "Speaker Repair", "Software Update (service)",
      "Data Transfer (service)", "Keypad Phone", "Smartphone", "Mobile Recharge",
    ].map((n) => [n, G]),
    electronics: [
      "HDMI Cable 3 m", "USB Cable Printer", "LAN Cable 10 m", "Wi-Fi Adapter USB", "Webcam", "Headphones", "Laptop Bag", "Laptop Stand",
      "Cooling Pad", "SSD 256GB", "Hard Disk 1TB", "RAM 8GB", "Printer Ink Cartridge", "Printer Toner", "Set Top Box", "DTH Remote",
      "TV Wall Mount", "AV Cable", "Extension Cord", "UPS 600VA", "Speakers 2.1", "Smart Plug", "LED TV 32 inch", "Calculator Scientific",
    ].map((n) => [n, G]),
    kitchen: [
      "Pressure Cooker 3 L", "Kadai", "Frying Pan", "Saucepan", "Steel Plates (6)", "Steel Glasses (6)", "Steel Bowls (6)", "Spoon Set", "Ladle (Karchi)",
      "Rolling Pin & Board (Chakla Belan)", "Tea Strainer", "Grater", "Chopping Board", "Vegetable Peeler", "Casserole", "Thermos Flask", "Water Jug",
      "Storage Containers Set", "Spice Box (Masala Dabba)", "Gas Stove 2 Burner", "Mixer Grinder", "Induction Cooktop", "Electric Kettle", "Toaster",
      "Dinner Set", "Tiffin Box", "Bucket", "Mug", "Dish Rack", "Scrubber", "Aluminium Foil", "Cling Wrap", "Matchbox Gas Lighter",
    ].map((n) => [n, G]),
    clothes: [
      "Men's T-shirt", "Men's Shirt Casual", "Men's Trousers", "Kurta Pyjama", "Men's Vest", "Men's Briefs", "Ladies Leggings", "Ladies Top", "Salwar Suit",
      "Nightgown", "Blouse", "Petticoat", "Kids Frock", "Kids Shorts", "Baby Clothes Set", "Sweater", "Shawl", "Cap", "Towel", "Bedsheet Double",
      "Pillow Cover", "Blanket", "Handkerchief (pack)", "Stitching / Alteration (service)",
    ].map((n) => [n, G]),
    footwear: [
      "Running Shoes", "School Shoes Black", "Floaters", "Flip Flops", "Ladies Heels", "Ladies Flats", "Kolhapuri Chappal", "Gum Boots",
      "Safety Shoes", "Shoe Laces", "Insoles", "Shoe Brush", "Shoe Repair (service)",
    ].map((n) => [n, G]),
    accessories: [
      "Wrist Watch Men", "Wrist Watch Ladies", "Kids Watch", "Watch Battery Change (service)", "Watch Strap", "Wallet Men", "Ladies Purse", "Handbag",
      "Backpack", "Travel Trolley Bag", "Duffel Bag", "Belt", "Sunglasses", "Umbrella", "Raincoat", "Hair Clips", "Bangles", "Artificial Jewellery Set",
    ].map((n) => [n, G]),
  };
  for (const [cat, list] of Object.entries(MORE)) {
    const have = new Set((D.CATALOG[cat] = D.CATALOG[cat] || []).map(([n]) => n.toLowerCase()));
    for (const [n, b] of list) if (!have.has(n.toLowerCase())) { D.CATALOG[cat].push([n, b, null]); have.add(n.toLowerCase()); }
  }
})();
