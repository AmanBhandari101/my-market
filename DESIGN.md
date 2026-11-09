# My Market for Business: design

How the shop app (business.html) should look and behave, and why. The customer app and the
admin tool have their own looks; this file is about the app a shopkeeper uses behind the counter.

## Who it is for

A shopkeeper standing at the counter, one hand on the phone, a customer waiting. Often in
bright light, often on a mid-range Android phone, sometimes reading English as a second
language. They open the app many times a day for a few seconds each time.

## Philosophy: calm counter

1. **The counter comes first.** Billing is the home screen. The things done every few minutes
   (bill, check orders, change stock) are one tap away on the bottom bar, where the thumb is.
   Everything done once a month lives on the **More** page, never in the way.
2. **One job per screen, one main button.** Each screen has a single green button for its
   main job. Everything else is a quiet outline button or a text link. Two loud buttons on one
   screen means the screen is doing two jobs.
3. **Colour means something.** Green = go / good / your action. Amber = needs a look soon.
   Red = a problem or something you can't undo. Grey = information. No colour is used only
   for decoration, so when something is coloured the owner knows to look at it.
4. **Quiet surfaces.** One page background (soft grey-green), white cards, one corner radius,
   one hairline border, almost no shadow. Space separates things before lines or boxes do.
5. **Type does the hierarchy.** One font (Inter). Four sizes: page title 20, section 17,
   body 15, small 13. Money is bold, with figures that line up.
6. **You always know where you are.** Main pages show the page name. Every other page has a
   back arrow and its name in the same place. No page is reached only through a hidden menu.
7. **Every tap answers.** Buttons press in, counts update at once, a short message confirms
   what happened. Nothing moves for more than 0.2 s.
8. **Plain words.** "Stock arrived", not "Inward entry". Say what will happen, in the
   owner's words, in as few words as possible.
9. **Staff tools stay out.** Nothing for My Market staff appears in the shop app. Admin is a
   separate tool (admin.html) with its own login.

## Navigation

Bottom bar with five tabs (all main pages):

| Tab | Page | What lives there |
|---|---|---|
| Bill | home | tap or scan items, cart, bills |
| Orders | #/biz/inbox | website orders and customer questions, with a count of waiting ones |
| Stock | #/biz/items | stock list, Stock arrived, add item |
| Reports | #/biz/reports | sales, analytics, running low, what people search for |
| More | #/biz/more | shop details, website, Google, alerts, plan, login, backup, log out |

Every other page is a sub-page with a back arrow to its tab. The top bar no longer carries
cart, bell and menu icons: the cart count is on the Bill tab and in the bill bar, the order
count is on the Orders tab, and the menu became the More page.

## Page-by-page review

| Page | Keep | Change | Later |
|---|---|---|---|
| Log in / Register | Clear promise, short login, help sheet | New look | Split the 15-field register form into two steps (shop + login now, address and hours after) |
| Bill (home) | Tiles sorted by best sellers, scan, item not in list | Quieter header | Favourites row; search by barcode digits |
| Cart | Agreed price, change to return, khata | Cleaner totals table | — |
| Bill (receipt) | Share, download, print, cancel | One main button (Share); New bill becomes secondary | — |
| Orders | Accept / keep aside / make bill, WhatsApp | Becomes a tab with a count; friendly empty state | Group by today / earlier |
| Stock | Steppers, filters, value at cost | Calmer stat tiles | Sort options |
| Stock arrived | Tap or scan each piece | Back arrow | — |
| Reports | Everything from Reports and the old Shop analytics page | **One page** in four groups (Sales · Best sellers · Stock · Customers) with sticky jump buttons; "Order soon" folded into Running low, "Money in your stock" into Not selling; website link moved to More | — |
| My website, Get found on Google | All of it | Under More, back arrow | — |
| Shop details, Login & security, My plan, Back up bills | All of it | Under More, back arrow | — |
| ☰ menu | — | Replaced by the More page | — |
| Admin link | — | **Removed** (admin is its own tool) | — |
| What people searched for | Data | Reached from Reports only (it already shows there) | — |

## Tokens (css/biz.css)

| Token | Value | Use |
|---|---|---|
| `--b-page` | #f2f5f3 | page background |
| `--b-card` | #ffffff | cards, top bar, bottom bar |
| `--b-line` | #e3e8e5 | hairlines |
| `--b-ink` / `--b-ink-2` / `--b-ink-3` | #14201a / #5b6a62 / #95a39b | text: main, secondary, faint |
| `--b-go` / `--b-go-dark` / `--b-go-soft` | #1a8a4c / #146e3c / #e6f4ec | main buttons, selected, good |
| `--b-warn` / `--b-warn-soft` | #b86e00 / #fff3dc | running low, payment due |
| `--b-bad` / `--b-bad-soft` | #b3261e / #fde8e6 | out of stock, cancel, errors |
| `--b-r` | 14px | cards; buttons 12px; chips round |

Spacing steps: 4, 8, 12, 16, 24, 32. Side margin 16.

---

# My Market (customer app): design

How index.html should look and behave. It is the same family as the shop app (same page
colour, white cards, light top bar, one font, same spacing) with its own colour, so a shopper
and a shopkeeper each know which app they're in.

## Who it is for

Someone who needs one thing today (a charger, a 1-inch elbow, a mattress) and wants to know
which shop near them has it, at what price and how far away, before leaving home. They
search, decide and go. Often on mobile data, often in a hurry.

## Philosophy: walk in knowing

1. **The answer first.** Every result leads with the three things that decide a trip: **in
   stock?**, **price**, **how far**. Photos and details come after.
2. **Search is the front door.** The search box is the first thing on Home and stays one tap
   away (Search tab). Nothing sits above it except the app name and where you are.
3. **Local, warm, honest.** Real shops near you, not a marketplace clone: no fake ratings, no
   invented MRP, no "deals" banners without real discounts. Say plainly when nothing is near.
4. **One main button per screen, in teal.** Teal = your action (Add to cart, Use my location,
   Directions). WhatsApp keeps WhatsApp green and appears only as WhatsApp. Marigold marks a
   find or a real deal. Red only for out of stock and cancel.
5. **Stock is a colour you can read at a glance.** Green dot = in stock, amber = few left or
   "ask to confirm", red = out. Same dot everywhere: search, shop page, product page.
6. **Tabs never go back.** Home, Search, Orders and You are tabs: no back arrow, their name in
   the top bar. Every other page has a back arrow in the same place.
7. **The shop's page is the shop's.** A shop's website keeps the shop's own colour and logo;
   My Market stays in the footer.
8. **Quiet surfaces, plain words.** Same rules as the shop app: one page colour, white cards,
   one radius, no heavy shadows, short sentences, Hinglish search welcome.

## Page-by-page review

| Page | Keep | Change | Later |
|---|---|---|---|
| Welcome | One clear promise, use my location | Light page; three lines on what the app does | — |
| Home | Search, range, in stock near you, categories, map | One light header (name + location), search right under it; the category strip, profile icon and repeated "1 shop within…" banner removed | Saved shops row |
| Search | Best answer card, also at, may have it, map/list, Hinglish | No back arrow (it's a tab); light header | Filters by price / open now |
| Product | Price, stock, sold by, compare, details, "found it here" | One main Add to cart; Hold / Buy as a pair; WhatsApp and Directions as small buttons | Photo gallery |
| Shop website | Its own colours, cart, Hold / Buy, map, hours | Kept as it is | — |
| My orders | Carts per shop, live tracking, cancel, order again | Tab: title in the top bar, no back arrow | — |
| You | Location, orders, saved shops, recent searches | Grouped lists like the shop app's More page; no back arrow | — |
| Bag / demo checkout / demo order / "ask nearby shops (simulated)" | — | **Removed** (old demo pages; real orders go through each shop's cart) | — |

## Tokens (css/customer.css)

Same as the shop app except the action colour:

| Token | Value | Use |
|---|---|---|
| `--c-go` / `--c-go-dark` / `--c-go-soft` | #0f766e / #0b5e57 / #e3f3f1 | main buttons, selected, links |
| `--c-find` / `--c-find-soft` | #c77700 / #fff4e0 | a find, a real deal |
| `--c-wa` | #1fa855 | WhatsApp only |
