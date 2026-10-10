# Digital Udyam — Master Change Request (sirf jo abhi baaki hai)

Pichle kaam mein ye pehle se ho chuka hai aur sirf check/thoda polish hoga: ₹699/6 mahine, ₹999/12 mahine, Multiple Branches (contact), branch limit database mein, 5/10/20 visits, 24 ghante ka niyam, ek permanent QR, Add-ons (₹189, ₹149), UPI payment jo admin confirm karta hai, ek customer = ek account.

Ab ye naye kaam honge:

## 1. Free Trial poori tarah hatana
- Homepage, Pricing, Signup, Onboarding, Dashboard, Subscription page se "free trial / 3 day" sab hata denge.
- Naya business register kare to plan "Payment pending" rahega. Dashboard khulega, par paid features (visit approve, offers, QR use) tabhi chalenge jab payment admin verify kare ya admin khud activate kare.
- Jin purane businesses ka trial chal raha hai unka data safe rahega; trial khatam hone par wo bhi renew prompt dekhenge.

## 2. Admin — Create User
- Admin panel mein "Create User" form: naam, business naam, email, mobile, category, address, plan, duration, payment method (UPI / Manual), payment status, activation/expiry date, notes.
- Account banne par: business, subscription, permanent QR apne aap banenge. User ko email par **password set karne ka invite link** jayega (koi default password nahi).
- Duplicate email/business rokenge. Kisne aur kab banaya — record hoga.

## 3. Admin — Subscription management
- Har business ka plan dekhna, 6↔12 mahine badalna, Multiple Branches dena, custom branch limit aur price set karna, start/expiry date sahi karna, renew, suspend/reactivate.
- Har badlaav ke liye reason zaroori; purana plan, naya plan, admin, time — sab history mein.

## 4. Payments — UPI + Manual (sirf admin)
- Business owner sirf UPI chun sakta hai. "I have paid" se kuch activate nahi hoga (status: Verification Required).
- Admin manual payment record kar sakta hai (amount, date, mode, reference, notes) aur UPI record ko Manual mein convert kar sakta hai — reason ke saath, purana UPI reference history mein bacha rahega.
- Ek payment se do baar activation nahi hoga.

## 5. Invoices
- Payment verify hote hi invoice banega (unique number, date, business, plan/add-on, duration, amount, method, reference, period). Unverified/failed payment ka invoice nahi banega.
- Business owner: Subscription page mein "Invoices & Billing" — list + PDF download.
- Admin: saare invoices, download, apne seller details (naam, address, GSTIN agar ho) Settings mein bharne ka option. GST hum khud nahi daalenge — jab tak aap GSTIN aur tax rate nahi bharte, invoice par tax nahi dikhega.

## 6. Customer registration
- QR scan par: Naam, Email, Mobile (zaroori), Date of Birth (optional).
- Indian mobile check (+91 ya 10 digit, 6–9 se shuru), email check, DOB future mein nahi — dono taraf (screen + server).
- Purana customer phone daale to seedha uska account khulega. OTP verification abhi nahi hai — ye clearly bataya jayega, "verified" nahi likha jayega.

## 7. Customer shop page — naya order
1. Stamp card (5/10/20 gol circles, tick wale bhare, "2/5 Visits Completed", countdown ya "Visit Available — Apply Now")
2. Google Review buttons (AI writer agar add-on chalu, warna seedha Google link)
3. Social links
4. Digital Menu / Catalog
5. Location, contact, baaki info

## 8. AI Review Writer upgrade
- Language: English / Hindi / Hinglish. Customer apna experience likhe.
- 3–4 alag drafts, category ke hisaab se (cafe, salon, car wash, retail, clinic, coaching, hotel, baaki). "More suggestions" button. Edit, copy, Google par khud post.
- Jhoothe experience ya zabardasti positive review nahi.

## 9. Social Media & Business Links
- YouTube, Google Maps, Google Reviews, Facebook, Instagram, WhatsApp, WhatsApp Group, WhatsApp Community, Telegram, X, LinkedIn — har ek ka on/off, URL check (sirf https links).
- Customer page par sirf bhare hue links icons ke saath.

## 10. Digital Menu / Catalog
- Restaurant/Cafe/Bakery = "Digital Menu" (dietary label: Veg/Non-veg/Vegan). Baaki = "Services Catalog" / "Product Catalog".
- Har item par optional WhatsApp enquiry button. Same QR se khulega.

## Bahar ki zaroorat (abhi nahi ho payega)
- OTP se phone verify — SMS provider chahiye.
- Automatic UPI verification — Razorpay keys chahiye; tab tak admin hi verify karega.
- Invite email ke liye default email system use hoga.

## Technical details
- Migration: `subscriptions` + `custom_max_branches`, `custom_price`, `notes`; `branch_limit_ok` custom limit ko pehle dekhe. `payments` + `method` (UPI/MANUAL), `verified_by`, `verified_at`, `admin_notes`, `paid_at`; status VERIFICATION_REQUIRED. New `invoices` table (unique per payment_id, sequential number). New `subscription_history` table. `businesses.social_links jsonb`. `menu_items` + `dietary_label`, `enquiry_enabled`. Signup trigger/onboarding stops creating TRIAL; `decideVisit`/feature checks treat TRIAL as expired after trial_ends_at (already) and new rows start PAST_DUE.
- Admin server fns (super-admin check first, then `supabaseAdmin`): `createBusinessUser` (auth.admin.inviteUserByEmail), `updateSubscriptionAdmin`, `recordManualPayment`, `convertPaymentToManual`, `listInvoicesAdmin`, `saveSellerDetails`. All write `audit_logs`.
- Invoice creation inside the same payment-verify function, idempotent via unique `payment_id`. PDF generated in browser with `jspdf`.
- Customer validation with zod shared schema (phone normalized to `+91XXXXXXXXXX`).
- Review writer returns JSON array of drafts via Lovable AI gateway with category prompt map.
