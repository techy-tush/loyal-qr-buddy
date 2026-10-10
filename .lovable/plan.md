# Digital Udyam — Complete Upgrade

Implemented in one coordinated pass, keeping existing data and working features.

## 1. Plans
- Plan A: ₹699 / 6 months, 1 branch. Plan B: ₹999 / 12 months, 1 branch. Plan C: Multiple branches, "Contact for pricing".
- Same features for A and B; only duration differs.
- Pricing page + Subscription page updated; UPI payment flow reused.
- Server blocks creating a 2nd branch unless the plan allows it. Expired subscription = restricted access with renew prompt.

## 2. Loyalty target
- Reward rule offers only 5 / 10 / 20 visits. Progress shown on dashboard, customer profile and shop page.

## 3. Roles and logins
- Super Admin, Business Owner, Customer kept separate.
- Shop owner scanning another shop's QR opens the customer experience, never their dashboard.
- Explicit "Switch to business dashboard" / "Switch to customer" option when a person has both.
- One customer identity across all shops (already in place, kept).

## 4. One permanent QR per shop
- Remove "create QR" options; each business gets exactly one fixed QR (existing first QR reused).
- QR page shows business info, login/register, loyalty progress, offers, "View Digital Menu" and "Write a Google review" when those add-ons are active.

## 5–6. 24-hour cooldown + "Visit available — Apply now"
- Server enforces 24h between approved visits per customer per shop.
- Customer sees a live countdown ("next visit in 8h 25m") or an "Apply now" button when eligible.

## 7. Add-ons marketplace (new dashboard section)
- AI Google Review Writer — ₹189/year. Digital Menu — ₹149/year.
- Buy one or both via UPI; Super Admin confirms payment, add-on activates for 12 months, expires automatically, renewable.
- Super Admin can edit add-on prices and see add-on payments.

## 8. AI Google Review Writer
- Owner sets Google review link and a few keywords/highlights.
- Customer picks rating + tags; AI writes a review suggestion they can edit, copy and then open Google Reviews.

## 9. Digital Menu
- Menu builder (categories, items, price, image, availability) — page re-enabled.
- Public mobile menu at /menu/shop-name, only while the add-on is active.

## 10–11. Admin
- Admin: manage plans and add-on prices, see subscription + add-on payments and expiry, suspend/activate accounts.

## Technical details
- New tables: `addons` (code, name, price_yearly, is_active) and `business_addons` (business_id, addon_code, status, expires_at) with RLS; payments gets `addon_code`.
- Plans gain `duration_months`; seed rows updated via data query, old plans deactivated (not deleted).
- `qr_codes`: unique index on business_id for BUSINESS type; create functions removed.
- Cooldown check moved into `requestVisit` + `decideVisit` (24h since last APPROVED).
- Review generation through Lovable AI gateway server function, gated on active add-on.
- Branch limit check in a server function + RLS insert check using plan max_branches.

## Not included
- Automatic online payment (still manual UPI confirmation by admin, since Razorpay keys were not provided).
