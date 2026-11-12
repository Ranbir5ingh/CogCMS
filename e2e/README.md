# Browser tests (Playwright)

These tests open the CMS in Chrome and use it like a person: log in, create and publish content, check permissions.

## Run them

```bash
npm run build       # always build first; the tests run against the built app
npm run test:e2e
```

If a test fails, `npx playwright show-report` shows a screenshot and step-by-step trace.

## Things to know

- **No real data is used.** Each run starts a temporary database with a test admin, a second test admin (`ADMIN_B`, used by the assignment collaboration specs), a test editor and two sites (see `support/fixtures.ts`). It is thrown away afterwards.
- **Tests run one at a time.** They share that database, so give new content a unique title (use `unique()` in `content.spec.ts`).
- **Don't remove the `x-real-ip` header** in `playwright.config.ts`. The built app refuses logins without it.
- **Read admin data with the helpers in `support/api.ts`**, not `page.request`. The login cookie only reaches the server through the browser page.
- **In CI these tests only report failures; they don't block merging.** To make them block, remove `continue-on-error: true` from the `e2e` job in `.github/workflows/ci.yml`.

## Assignment verification

`assignment-verification.spec.ts` is a full walkthrough of the Media Library and Live Collaboration features (uploads and rejection, variants, pickers, two-admin locks, comments, polling fallback, site isolation). It is optional and is not a CI gate.

The Playwright run shares one database across files, so this spec does not assume an empty library — it is safe to run after `assignment-screenshots.spec.ts` or the content/events specs.

`assignment-screenshots.spec.ts` refreshes the images under `docs/screenshots/`.
