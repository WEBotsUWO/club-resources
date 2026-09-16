# Club Resources

Shared club resources, with independent WeBots and CHRC organizations.

- [WeBots chart](https://webotsuwo.github.io/club-resources/webots/org-structure/)
- [CHRC chart](https://webotsuwo.github.io/club-resources/chrc/org-structure/)
- [Editing and permissions](EDITING.md)

## Organization

`webots/org-structure/chart.json` owns the WeBots roles, assignments, and team colors.
`chrc/org-structure/chart.json` owns the separate CHRC organization. Each club has its own HTML entry point. The shared React renderer and editor live in `src/`.

The WeBots CHRC competition team remains an engineering team within WeBots. CHRC's competition-organizing leadership is the independent CHRC chart.

WeBots has a flat executive layer under the president: VP Operations, VP Sponsorships, VP Social Media, and the two Directors of Engineering. The three VP roles have no subordinate cards. The engineering program branches remain under their Directors of Engineering. CHRC has two separate, assignable VP Logistics positions.

## Development

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Open `/webots/org-structure/` or `/chrc/org-structure/`. All routes are read-only until an authorized editor connects. The root route opens WeBots.

## Publishing

The GitHub Actions workflow builds and deploys `main` to GitHub Pages. Select **GitHub Actions** as the Pages source. An editor's Publish button commits only the current club's JSON to `main` through GitHub's Contents API. Each update checks the original file SHA to prevent overwriting someone else's changes.

Public viewers fetch the current chart from GitHub. If that request fails (including rate limits), the deployed JSON provides a fallback. A new hosted fallback is deployed after each successful workflow run. Public readers refresh the page to see new data; live polling is not used.

## Embedding

```html
<iframe
  src="https://webotsuwo.github.io/club-resources/webots/org-structure/?embed=1"
  title="WeBots organization"
  style="width:100%;height:760px;border:0"
  loading="lazy"
></iframe>
```

Replace `webots` with `chrc` for CHRC. Embeds omit the navigation and editor entry point. `?view=1` remains compatible but is unnecessary because public view is the default.

## Migration

Extracted from `WEBotsUWO/webots-discord-bot/org-structure` on 2026-09-13. The original repository retains history and a redirect at its old public org-chart URL. Its Discord posting integration remains with the bot; chart source and data now belong here.
