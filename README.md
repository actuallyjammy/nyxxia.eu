# jammy.cat

Bilingual personal homepage and election simulators. Built with Next.js static export.

## Cloudflare Pages

Connect `actuallyjammy/nyxxia.eu`, production branch `main`, as a **Pages** project:

- Build command: `npm run build`
- Build output directory: `out`
- Root directory: repository root (leave blank)

Pages deploys the output automatically. Do not use `npx wrangler deploy`, which targets Workers. For a manual Pages upload, use `npx wrangler pages deploy out --project-name=<your-pages-project-name>` after building.

The `functions/` directory contains the inquiries Pages Function. Preserve the D1 binding named `DB` from `wrangler.jsonc`; the configured database must exist in the deployment account.

After a successful deployment, add `jammy.cat` under the Pages project's Custom domains and follow Cloudflare's DNS instructions.

## Local development

```sh
npm ci
npm run dev
```

`npm run build` exports to `out/`. Simulator assets are served from `public/`; the Parliament and Catalunya assets were synchronized from the maintained local HTML project. Browser saves remain local to each browser and origin.
