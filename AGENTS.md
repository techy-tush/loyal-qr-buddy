<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The authenticated workspace uses one role-aware AppShell: a collapsible desktop sidebar and a fixed five-destination mobile bar, keeping navigation consistent across all business routes.
- Paid add-ons live in `addons` + `business_addons`; gate features with the `addon_active()` SQL function server-side — never trust the client.
- Visit cooldown (24h) is enforced in `stamp.server.ts` (`VISIT_COOLDOWN_MS`, `nextVisitAt`) — one source of truth for request and approval.
- Branch limits and one-QR-per-shop are enforced by DB triggers, so UI changes cannot bypass them.
