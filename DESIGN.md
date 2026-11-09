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
