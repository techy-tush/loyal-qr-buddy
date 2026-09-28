# App ko simple banana: Scan approval, ek Offer, ek Rewards

## Kya banega (simple flow)

```text
Customer QR scan karta hai
   -> "Visit request" banti hai (Pending)
   -> Shop owner ke Dashboard par sabse upar "Approval list" dikhegi
   -> Owner: Approve ya Reject
   -> Approve par visit count hota hai; target poora hone par Reward apne aap ban jata hai
   -> Rewards page par jeete hue rewards ki list + "Redeem" button
```

## 1. Scan approval (main feature)
- Customer scan kare to seedha stamp nahi lagega; ek request banegi.
- Jis account ne business banaya (owner) wahi approve/reject karega.
- Dashboard ke upar "Pending approvals" list: customer ka naam, phone, time, Approve / Reject buttons.
- Customer ki screen par dikhega: "Request bheji gayi — owner approve karega", phir approved/rejected status.

## 2. Hataye jayenge (menu se)
- Stamp Card page, Scratch Card page, Claims, alag Loyalty setup screens.
- Purana data delete nahi hoga, sirf menu aur customer screens se hat jayega.
- Bas ek setting rahegi: "Kitni visits par reward milega" aur "Reward kya hai".

## 3. Offers — ek hi jagah
- Offer banate waqt sirf do option: **Free product** ya **Discount (% ya ₹)**.
- Title, description, start/end date, on/off. Baaki complicated options hatenge.

## 4. Rewards — ek simple list
- Status ke 4 tabs hatenge. Ek list: jo customer jeeta, kya jeeta, code.
- "Redeem" button (ya code type karke redeem). Redeem hone par list me "Redeemed" dikhega.

## 5. Customer profile fix
- Customer ki card screen par neeche "Profile / Settings" tab jo abhi nahi khulta — usme customer apna naam, phone, birthday dekh aur badal sakega.

## 6. Admin panel fix
- Admin panel sirf platform admin ko dikhega; shop owner aur customer ko alag-alag sahi screen milegi (abhi sab "visitor" jaisa dikh raha hai, use theek karenge).

## 7. Razorpay connection
- Razorpay ke 3 keys maangunga (Key ID, Key Secret, Webhook Secret) — aap secure box me daalenge.
- Subscription page par "Pay with Razorpay" chalu ho jayega; payment hone par plan active.

## Mobile menu (neeche 5 buttons)
Dashboard (approvals) · Customers · Offers · Rewards · Settings

## Technical details
- New table `visit_requests` (business_id, customer_id, branch_id, status PENDING/APPROVED/REJECTED, decided_by, decided_at) with GRANTs + RLS: insert only via server function from public QR flow; select/update only for `is_business_admin(business_id)`.
- Approve server fn (requireSupabaseAuth, owner/admin check) reuses existing stamp engine (`stamp.server.ts`) so cooldown/daily limit/reward auto-creation stay server-side; audit log entries kept.
- Realtime or 15s refetch for the dashboard approval list.
- Offers UI restricted to `FREE_PRODUCT` and `PERCENT`/`FLAT`; enum unchanged.
- Nav in AppShell trimmed; routes for loyalty/scratch/stamp removed from nav (files may stay for existing data or be deleted).
- Customer portal `/card/$customerToken` gets a Profile tab using a token-validated server fn.
- Admin route gated by `is_super_admin`; role redirect after login (owner -> dashboard, admin -> /admin).
- Razorpay: add secrets RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET; existing billing code + webhook at `/api/public/razorpay-webhook` wired to checkout.
