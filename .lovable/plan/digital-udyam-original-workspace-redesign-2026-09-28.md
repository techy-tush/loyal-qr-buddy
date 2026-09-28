# Digital Udyam original workspace redesign

## Goal
Rebuild the authenticated business experience as an original, premium, mobile-first SaaS interface while preserving the existing live database, permissions, and business workflows.

## Selected direction
- Emerald Prestige palette: deep emerald navigation, ivory workspace, restrained gold status accents
- Sora headings with Manrope body text
- Modern dashboard structure
- Selected action-led mobile direction, adapted into an original Digital Udyam system rather than copying the reference product
- Fixed five-item mobile navigation: Dashboard, Customers, Rewards, Claims, Settings
- Refined desktop sidebar with the full role-aware navigation

## Implementation
1. Establish the new global tokens, typography, spacing, surfaces, and motion rules, including reduced-motion support.
2. Rebuild the shared app shell with responsive navigation, business and branch context, profile actions, and compact mobile controls.
3. Recompose the dashboard around real metrics: business status, quick actions, KPI summary, charts, recent activity, and clear loading/empty states.
4. Upgrade the reference-led workflows already present: onboarding, customer discovery/filtering/export, QR management, loyalty/reward programs, offers, scratch-card claims, branches, staff, campaigns, feedback, subscription, and admin.
5. Add missing user-facing destinations needed by the requested navigation, using only existing real data and permissions.
6. Verify metadata, compilation, runtime behavior, authenticated flows, and responsive layouts at mobile, tablet, and desktop sizes.

## Technical details
- Keep TanStack Router links and the existing authenticated route gate.
- Keep Lovable Cloud queries and mutations; no hard-coded operational data.
- Preserve tenant isolation and role checks; presentation changes will not weaken row-level access controls.
- Reuse the existing design-system controls and semantic tokens.
- Use stable responsive grids, touch-sized controls, and no nested decorative cards.
