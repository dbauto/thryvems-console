# Console visual alignment — ThryveMS design DNA

25 October 2026. **Design review branch only** — do not merge or deploy without owner approval.

## Canonical visual reference

- Live UI: https://dbauto.github.io/afdhlskdfs-iqms-preview/
- Normative guidelines: https://github.com/dbauto/afdhlskdfs-iqms-preview/blob/main/app/UI-GUIDELINES.md
- Existing client FigureGrid/PageHeader/sidebar/controls: main frontend `app/src/components/app/`.
- This console keeps all its existing route names, navigation order, summary content, button wording, simulated workflows, financial calculations and role scoping.

## What was wrong with the prior console UI

- Navigation and KPI icons used ad hoc Unicode shapes (e.g. arrows, squares and chess glyphs), unlike the established Lucide outline iconography of ThryveMS.
- The desktop sidebar did not collapse to icon-only navigation.
- Dashboard hierarchy could be clearer without replacing the established card/data-table design.
- The console duplicated presentation conventions in its own stylesheet rather than documenting the source-of-truth UI rules.

## Changes

- Loads the same **Public Sans** weights (400/500/600/700) from the pinned @fontsource package at build time, rather than relying on an installed system font. No external runtime font service.
- Use **Lucide** (pinned `lucide-static@0.544.0`) for icons in both workspace navigation trees and all figure cards. The build emits only the selected SVG symbols; no CDN requests, icon fonts or emoji substitutions. Icons are decorative and have `aria-hidden`; nav links preserve explicit text/aria labels.
- Uses the **existing official vector mark** copied from the canonical frontend `app/public/thryvems-mark.svg` instead of the placeholder letter T. A separate console sidebar logo PR #3 is open and must be reconciled without discarding the approved official asset. Sidebar collapses to icons and expands on demand; mobile continues using the existing accessible mobile navigation. Does not change the menu, its order or wording.
- Align page hierarchy, sections, KPI cards, compact rows, borders, status design, responsive behavior and focus with existing ThryveMS token surfaces.
- Use [ReUI Dashboard 1](https://reui.io/blocks/application/dashboard/dashboard-1) and [ReUI Stats 1](https://reui.io/blocks/application/stats/stats-1) only as **layout/composition references**: KPI sections followed by filtered operational lists and details. No ReUI paid template, new ReUI visual tokens, unrelated gradients, charts or external library theme was copied.
- Keep the existing synthetic preview engine, ledger calculations and client/partner data isolation logic untouched. A React/shadcn migration is a separate architectural choice and is **not silently performed**.

## UI-GUIDELINES §10 acceptance

- [ ] `npm run typecheck`, `npm run unit`, `npm run build`, `npm run e2e`, and GitHub Check pass on the design source commit.
- [ ] Screenshots demonstrate Developer and Business pages in light/dark at 390, 768, 1280 and 1920px, including sidebar collapsed.
- [ ] No new raw hex or Tailwind palette styles, fonts, menus, labels, or changed ThryveMS token values.
- [ ] All visual changes checked for mobile overflow, accessible icon labels and both preview workspaces.
- [ ] Unchanged role scope: a partner cannot open Developer pages or see another partner's records/actual infrastructure costs.
- [ ] `plan/progress.md` updated last with actual checks and backend assessment.

## Backend impact: No backend impact

This is strictly an icon and presentation/navigation layout update. No schema/relationships, APIs, permission rules, financial formulas, client/sandbox/release workflows, integrations, events, or runtime tests for those contracts change. Existing deployment and finance architecture remains **Pending** in [backend PR #14](https://github.com/dbauto/thryvems-backend/pull/14). A new backend architecture PR is not required for this visual-only work. Do not mark existing backend synchronization complete.
