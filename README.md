# Digital Udyam: Loyalty Platform

Build a complete production-ready SaaS application called:

DIGITAL UDYAM

Tagline:

"Turn Every Visit Into a Repeat Customer"

IMPORTANT:

This must be a REAL WORKING APPLICATION, not just a landing page, static dashboard or UI prototype.

Build the complete application using:

Frontend:

- React

- TypeScript

- Vite

- Tailwind CSS

- shadcn/ui

- React Router

- React Query / TanStack Query

- Recharts for analytics

- Lucide icons

Backend:

- Supabase

- PostgreSQL

- Supabase Authentication

- Supabase Storage

- Supabase Edge Functions where required

Architecture:

- Multi-tenant SaaS

- Role-based access control

- Row Level Security

- Real database CRUD

- Secure server-side operations

- Responsive web application

- Mobile-first customer experience

DO NOT use fake/mock data for actual application functionality.

==================================================

1. BRAND

==================================================

Product Name:

Digital Udyam

Primary tagline:

Turn Every Visit Into a Repeat Customer

Secondary tagline:

QR Loyalty & Customer Retention Platform for Local Businesses

Brand style:

- Modern

- Premium

- Minimal

- Clean

- Friendly

- Professional

- SaaS

- Local-business focused

COLOR SYSTEM:

Primary Pastel Green:

#8BCFAF

Dark Green:

#4F9F78

Light Green:

#E8F7EF

Background:

#F8FBF9

White:

#FFFFFF

Dark Text:

#17231D

Muted Text:

#68756E

Border:

#DDE9E2

Success:

#4CAF7D

Warning:

#E7A93B

Error:

#D9534F

Use pastel green and white as the dominant visual language.

Do not use excessive gradients.

Use:

- clean cards

- subtle shadows

- 12–16px radius

- spacious layouts

- modern typography

- professional charts

- responsive tables

- polished empty states

==================================================

2. PRODUCT PURPOSE

==================================================

Digital Udyam helps local businesses increase repeat customers through:

QR Loyalty

Digital Stamp Cards

Rewards

Customer CRM

Offers

Scratch Cards

Digital Menu

Customer Feedback

Analytics

Retention Automation

Multi-Branch Management

Target businesses:

- Cafes

- Restaurants

- Salons

- Spas

- Gyms

- Retail shops

- Bakeries

- Car washes

- Clinics

- Local service businesses

- Small chains

- Franchise businesses

==================================================

3. USER ROLES

==================================================

Create these roles:

SUPER_ADMIN

BUSINESS_OWNER

BUSINESS_MANAGER

STAFF

CUSTOMER

SUPER_ADMIN:

- Manage all businesses

- Manage plans

- Manage subscriptions

- Manage users

- Platform analytics

- Support tickets

- System settings

BUSINESS_OWNER:

- Full business access

- Branches

- Staff

- Customers

- Loyalty

- Offers

- Rewards

- Scratch cards

- Menu

- Analytics

- Subscription

- Settings

BUSINESS_MANAGER:

- Assigned branch management

- Customers

- Stamps

- Rewards

- Offers

- Analytics

STAFF:

- Scan QR

- Issue stamps

- Redeem rewards

- View limited customer data

CUSTOMER:

- Register/login

- Loyalty card

- Stamps

- Rewards

- Offers

- Scratch cards

- Menu

- Feedback

==================================================

4. MULTI-TENANT ARCHITECTURE

==================================================

Digital Udyam must be a multi-tenant SaaS.

Each business is completely isolated.

Example:

Business A:

Green Bean Cafe

Business B:

Style Studio

Business C:

FitZone Gym

Business A must NEVER be able to access Business B data.

Use:

business_id

on all relevant database tables.

Implement Supabase Row Level Security.

Create proper policies for:

- businesses

- branches

- staff

- customers

- loyalty programs

- stamps

- rewards

- offers

- menus

- analytics

- subscriptions

Do not rely only on frontend authorization.

==================================================

5. PUBLIC WEBSITE

==================================================

Create:

/

 /features

 /how-it-works

 /pricing

 /faq

 /contact

 /login

 /signup

HERO:

Turn Every Visit Into a Repeat Customer

Description:

Digital Udyam helps local businesses build customer loyalty, increase repeat visits and manage customer relationships with one simple QR-powered platform.

Buttons:

Start Free Trial

See How It Works

Include:

- QR illustration

- Digital loyalty card preview

- Analytics preview

- Customer CRM preview

Sections:

1. Hero

2. How It Works

3. QR Loyalty

4. Digital Stamp Cards

5. Customer CRM

6. Offers & Rewards

7. Analytics

8. Digital Menu

9. Multi-Branch

10. Pricing

11. FAQ

12. CTA

13. Footer

==================================================

6. BUSINESS SIGNUP

==================================================

Create a multi-step onboarding wizard.

STEP 1:

Account

Fields:

Full Name

Email

Mobile

Password

STEP 2:

Business

Business Name

Category

Phone

Email

Website

Address

City

State

Pincode

Logo

STEP 3:

First Branch

Branch Name

Address

Latitude

Longitude

Opening Time

Closing Time

STEP 4:

Loyalty Program

Example:

Collect 10 stamps and get FREE Coffee.

Fields:

Program Name

Stamps Required

Reward Type

Reward Description

Reward Expiry

STEP 5:

QR

Generate business QR.

Show:

QR preview

Download PNG

Print QR

Copy QR link

STEP 6:

Dashboard

Redirect to business dashboard.

==================================================

7. BUSINESS DASHBOARD

==================================================

Create a premium SaaS dashboard.

Sidebar:

Dashboard

Customers

Loyalty

QR Codes

Rewards

Offers

Scratch Cards

Digital Menu

Branches

Staff

Campaigns

Analytics

Subscription

Settings

Support

Top header:

Business name

Branch selector

Notifications

Profile menu

Dashboard cards:

Total Customers

New Customers

Repeat Customers

QR Scans

Stamps Issued

Rewards Earned

Rewards Redeemed

Charts:

Customer Growth

QR Scans

Repeat Visits

Stamp Activity

Reward Redemptions

Recent Activity:

New customer

Stamp issued

Reward unlocked

Reward redeemed

Offer redeemed

==================================================

8. CUSTOMER CRM

==================================================

Create full customer management.

Customer table:

Name

Phone

DOB

Anniversary

Last Visit

Visits

Stamps

Rewards

Status

Search.

Filters:

New

Repeat

Inactive

Birthday

Anniversary

VIP

Reward Available

Customer detail page:

Profile

Loyalty Card

Visits

Stamps

Rewards

Offers

Feedback

Activity

Stats:

Total Visits

Total Stamps

Rewards Earned

Rewards Redeemed

Last Visit

==================================================

9. QR SYSTEM

==================================================

Create QR management.

QR types:

Business QR

Branch QR

Campaign QR

Menu QR

Loyalty QR

Route:

/qr/:token

When scanned:

Identify business

Identify branch

Track scan

Open customer experience

QR must use secure tokens.

Generate:

PNG

SVG

Allow:

Download

Print

Copy Link

==================================================

10. CUSTOMER QR FLOW

==================================================

Customer scans QR.

Show mobile page:

Business Logo

Business Name

Current Offer

Button:

Join Loyalty Program

Registration:

Name

Phone

DOB optional

Anniversary optional

Marketing consent

After registration:

Show digital loyalty card.

==================================================

11. DIGITAL LOYALTY CARD

==================================================

Create premium digital stamp card.

Example:

○ ○ ○ ○ ○

○ ○ ○ ○ ○

10 Visits = FREE Coffee

Display:

6 / 10 Stamps

Progress bar.

Message:

"3 more visits to unlock your reward"

Animate the stamp when added.

==================================================

12. STAMP SYSTEM

==================================================

Stamp issuance must happen through secure backend logic.

Never trust frontend stamp count.

Flow:

Customer QR

→ Customer identified

→ Staff confirms

→ Backend validates

→ Stamp event created

→ Loyalty card updated

Rules:

- cooldown

- duplicate prevention

- daily limit

- branch validation

- staff authorization

- audit log

Allow business to choose:

Staff Approval

OR

Self Scan

==================================================

13. REWARD SYSTEM

==================================================

When customer reaches required stamps:

Automatically create reward.

Reward:

Unique Code

Customer

Business

Reward Description

Created Date

Expiry Date

Status

Statuses:

AVAILABLE

REDEEMED

EXPIRED

CANCELLED

Redemption:

Staff enters/scans reward code.

Backend verifies:

- reward exists

- correct business

- correct customer

- not expired

- not already redeemed

Then redeem.

Create audit log.

==================================================

14. OFFERS

==================================================

Business can create:

Percentage Discount

Flat Discount

BOGO

Free Product

Custom Offer

Fields:

Title

Description

Image

Discount

Start Date

End Date

Usage Limit

Branch

Audience

Audience:

All Customers

New Customers

Repeat Customers

Inactive Customers

VIP Customers

==================================================

15. SCRATCH CARDS

==================================================

Create digital scratch cards.

Business creates campaign.

Fields:

Campaign Name

Start

End

Trigger

Prizes:

Prize

Probability

Reward

Expiry

Example:

10% OFF — 20%

FREE Coffee — 5%

Try Again — 75%

IMPORTANT:

Winning logic must execute server-side.

Do not calculate probability in frontend.

Prevent duplicate claims.

==================================================

16. DIGITAL MENU

==================================================

Create menu builder.

Categories:

Food

Coffee

Drinks

Desserts etc.

Items:

Name

Description

Price

Image

Availability

Customer URL:

/menu/:businessSlug

Create beautiful mobile menu.

==================================================

17. FEEDBACK

==================================================

Customer can submit:

Rating

Comment

Business dashboard:

Average Rating

Total Reviews

Recent Reviews

Create filters.

Also configure:

Google Review URL

Instagram URL

WhatsApp Number

Customer buttons:

Google Review

Follow Instagram

WhatsApp

==================================================

18. MULTI-BRANCH

==================================================

Business can add branches.

Branch:

Name

Address

Phone

Latitude

Longitude

Opening Hours

Each branch:

QR

Staff

Analytics

Allow branch selector in dashboard.

Use GPS only when business enables location validation.

Do not continuously track customer location.

==================================================

19. ANALYTICS

==================================================

Business analytics:

Total Customers

New Customers

Repeat Customers

Repeat Rate

QR Scans

Stamps

Rewards

Redemptions

Offers

Scratch Cards

Charts:

Daily

Weekly

Monthly

Yearly

Branch analytics.

Customer retention analytics.

==================================================

20. NOTIFICATION SYSTEM

==================================================

Create notification architecture.

Events:

Reward Unlocked

Reward Expiring

Birthday

Anniversary

Inactive Customer

New Offer

Channels:

Email

SMS

WhatsApp

Create notification_logs table.

Do not hard-code provider.

Use provider abstraction.

==================================================

21. AUTOMATION

==================================================

Birthday automation.

Anniversary automation.

Win-back automation.

Example:

Customer inactive for 30 days.

Create:

"Come back and enjoy 10% OFF."

Create scheduled backend functions.

==================================================

22. SUBSCRIPTION

==================================================

Plans:

STARTER

GROWTH

PRO

ENTERPRISE

Starter:

1 branch

QR

Loyalty

Customers

Basic analytics

Growth:

3 branches

Offers

Scratch Cards

Digital Menu

Advanced Analytics

Pro:

6 branches

Advanced CRM

Automation

Advanced Analytics

Enterprise:

Custom

Unlimited branches

API

Franchise

Create:

plans

subscriptions

payments

invoices

Create payment abstraction for:

Razorpay

Stripe

Do not store card information.

Trial:

3 days.

Show:

Current Plan

Trial Remaining

Renewal Date

Upgrade

Cancel

==================================================

23. SUPER ADMIN

==================================================

Create:

/admin

Dashboard:

Businesses

Active Businesses

Trial Businesses

Paid Businesses

Customers

QR Scans

Revenue

Subscriptions

Pages:

Businesses

Users

Plans

Subscriptions

Payments

Support

Analytics

Settings

Admin actions:

Activate

Suspend

Change Plan

==================================================

24. DATABASE

==================================================

Create PostgreSQL schema.

Tables:

profiles

businesses

branches

business_staff

customers

loyalty_programs

loyalty_cards

stamp_events

rewards

offers

offer_redemptions

scratch_campaigns

scratch_prizes

scratch_wins

menus

menu_categories

menu_items

feedback

campaigns

notifications

notification_logs

qr_codes

subscriptions

plans

payments

audit_logs

support_tickets

Use UUID primary keys.

Use timestamps.

Create foreign keys.

Create indexes.

Use unique constraints.

==================================================

25. SECURITY

==================================================

Implement:

Supabase Auth

RLS

RBAC

Tenant isolation

Input validation

Secure QR tokens

Secure reward tokens

Audit logs

Rate limiting where possible

No secret keys in frontend.

No service role key in frontend.

All sensitive operations must happen server-side.

==================================================

26. DEMO DATA

==================================================

Create demo business:

Green Bean Café

2 branches

20 customers

50 visits

10 rewards

5 offers

Digital menu

Sample analytics

Create realistic data.

Use database records, not hard-coded dashboard numbers.

==================================================

27. RESPONSIVE DESIGN

==================================================

Desktop:

Professional SaaS dashboard.

Tablet:

Responsive grid.

Mobile:

Customer experience must be excellent.

Business dashboard should also be responsive.

Use bottom navigation on mobile if useful.

==================================================

28. UX

==================================================

Create:

Loading states

Skeletons

Empty states

Error states

Success messages

Toast notifications

Confirmation dialogs

Example:

"No customers yet"

"Share your QR code to get your first customer."

==================================================

29. SEO

==================================================

Title:

Digital Udyam | QR Loyalty & Customer Retention Platform

Description:

Digital Udyam helps local businesses increase repeat visits using QR loyalty cards, digital stamps, rewards and customer CRM.

Create:

robots.txt

sitemap.xml

==================================================

30. PERFORMANCE

==================================================

Use:

Lazy loading

Pagination

Optimized queries

Database indexes

Debounced search

Server-side filtering

Never load thousands of customers at once.

==================================================

31. IMPORTANT DEVELOPMENT RULE

==================================================

Do not build everything as a visual mockup.

Every major feature must be connected to Supabase.

Do not use fake buttons.

Do not use fake authentication.

Do not use localStorage as the primary database.

Do not hard-code customer data.

Do not hard-code analytics.

Use real CRUD operations.

==================================================

32. IMPLEMENTATION ORDER

==================================================

Build in this order:

PHASE 1:

Project setup

Design system

Authentication

Database

RLS

Roles

PHASE 2:

Business onboarding

Business dashboard

Branches

Staff

PHASE 3:

QR system

Customer registration

Customer portal

PHASE 4:

Loyalty card

Stamp engine

Rewards

Redemption

PHASE 5:

CRM

Offers

Feedback

Digital Menu

PHASE 6:

Scratch Cards

Analytics

Campaigns

PHASE 7:

Subscriptions

Plans

Payments architecture

PHASE 8:

Super Admin

PHASE 9:

Automation

Notifications

Birthday

Win-back

PHASE 10:

Security audit

Performance

Testing

Mobile optimization

==================================================

33. TESTING

==================================================

After implementation test:

Business signup

Login

Logout

Password reset

Onboarding

Branch creation

Staff creation

QR generation

Customer signup

Stamp

Reward

Redemption

Offer

Scratch card

Menu

Feedback

Analytics

Subscription

Admin

Test tenant isolation.

Test unauthorized access.

Test duplicate reward redemption.

Test stamp manipulation.

Fix issues instead of only reporting them.

==================================================

34. FINAL REQUIREMENT

==================================================

The final result must feel like a real SaaS product.

Product:

DIGITAL UDYAM

Brand:

Pastel Green + White

Core positioning:

"Turn Every Visit Into a Repeat Customer"

Build the complete working application with:

React

TypeScript

Vite

Tailwind

shadcn/ui

Supabase

PostgreSQL

Authentication

RLS

Real CRUD

Real QR

Real loyalty

Real rewards

Real CRM

Real analytics

Real role permissions

Real admin panel

Do not stop at the landing page.

Build the actual software.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://loyal-qr-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/16abe625-ecd1-4261-8d03-b084bb5e3b68).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
