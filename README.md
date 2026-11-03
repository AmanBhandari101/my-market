# My Market — v1 prototype

## Live pilot

| App | For | Open |
|---|---|---|
| **My Market** | Customers: find which nearby shop has an item, at what price | https://amanbhandari101.github.io/my-market/ |
| **My Market Business** | Shops: billing, stock, reports; register with mobile number + 6-digit PIN | https://amanbhandari101.github.io/my-market/business.html |

Both install on Android from Chrome (menu → *Install app*). Data lives in a Supabase project (Mumbai);
the database setup is in `supabase/` (`schema.sql`, `searches.sql`, `catalog.sql`, see `supabase/SETUP.md`).


Find which local shop has the item you need, buy or reserve it, and walk straight to it.
Shops get customers, customer questions and a "what to stock next" report with almost no typing.

## Run it
No build step: it is plain HTML, CSS and JavaScript. From this folder:
```
python -m http.server 8896
```
Open http://localhost:8896.
GPS needs `localhost` or `https`, so it won't work from a plain LAN IP on a phone.
After changing JS/CSS, bump the `?v=` numbers in `index.html` so browsers don't serve stale files.

## Customer side
| Screen | What it does |
|---|---|
| Welcome / location | GPS or area search (OpenStreetMap), Karol Bagh pilot |
| Home | Map (markets → shops on zoom), markets nearby, category filter |
| Search | English + Hinglish + typos; best answer first, "Also at", list/map |
| Shop page | Product grid like Amazon/Flipkart: photo, brand, rating, price, MRP, % off, stock, + Add |
| Product page `#/item/:shop/:item` | Photo, price, stock, pickup / delivery / reserve, qty, Add to bag, Buy now, **same item at other shops**, details, found-it feedback, notify when back |
| Bag `#/bag` | Grouped by shop (each shop = one order) |
| Checkout `#/checkout/:shop` | Pickup or delivery (₹39, free above ₹999); pay at shop / UPI / cash on delivery — **demo, nothing charged** |
| Order `#/order/:id` | Pickup code, live status timeline, directions, cancel |
| Ask shops `#/ask` | Question goes to up to 8 matching shops; replies appear live; re-open from Profile |
| Directions | Real walk/bike/car route, Google Maps hand-off, last-100 m landmarks |

## Shop-owner side (`#/biz`, from Profile → "Own a shop?")
| Screen | What it does |
|---|---|
| Onboarding | Why join, then **Find my shop** (claim with a code) or **Add my shop** |
| Claim | Pick your listing → verify with a code (demo code shown on screen) |
| Add shop | Name, category, area, shop no., landmark, hours, holiday, drag pin on map |
| Setup | "Tap what you sell" from the catalogue — no typing |
| Dashboard | Visits, questions waiting, active orders, missed searches; answer questions (Yes + price / No); move orders along (Accept → Ready → Collected) |
| Items | In-stock switch, price box, **Scan shelf** (photo → items, simulated), add from list |
| Insights | "What to stock next": searches near you that no shop could fill, with "I stock this" |

The same browser plays both roles, so you can ask/reserve as a customer and answer as the owner.
Other shops reply and move orders forward automatically (simulated).

## Demo data
24 fictional shops in 3 Karol Bagh markets (`js/data.js`). Profile → "Place demo markets around me" moves them next to you.
Product photos: Wikimedia Commons under free licences — see [CREDITS.md](CREDITS.md). Only checked photos are used
(`PHOTOS` list in `js/api.js`); other items show a category drawing. Profile → "Reset all demo activity" clears everything.

## Files
- `js/data.js` — demo markets, shops, catalogue
- `js/api.js` — the only data layer: nearby, search, ask, bag, orders, owner tools, missed sales. **Replace with backend calls in v2.**
- `js/app.js` — shared UI helpers, router (`ROUTES`), home, search, shop page, ask, directions, profile
- `js/shop.js` — product page, bag, checkout, orders
- `js/biz.js` — shop-owner screens
- `css/app.css` (design tokens, base screens), `css/commerce.css` (shopping + owner screens)

## Licence
Code: [MIT](LICENSE). Product photos in `img/items/` are not covered by MIT; each keeps its own
Wikimedia Commons licence, listed in [CREDITS.md](CREDITS.md).

## Not real yet
Backend + database, accounts/login, real WhatsApp (questions, codes, order alerts), real payments (UPI gateway),
real shelf-photo AI, delivery partners, ads, billing-software sync.
