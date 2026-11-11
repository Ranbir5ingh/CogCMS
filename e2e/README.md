# Browser tests (Playwright)

These tests open the CMS in Chrome and use it like a person: log in, create and publish content, check permissions.

## Run them

```bash
npm run build       # always build first; the tests run against the built app
npm run test:e2e
```

If a test fails, `npx playwright show-report` shows a screenshot and step-by-step trace.

## Things to know

- **No real data is used.** Each run starts a temporary database with a test admin, a test editor and two sites (see `support/fixtures.ts`). It is thrown away afterwards.
- **Tests run one at a time.** They share that database, so give new content a unique title (use `unique()` in `content.spec.ts`).
- **Don't remove the `x-real-ip` header** in `playwright.config.ts`. The built app refuses logins without it.
- **Read admin data with the helpers in `support/api.ts`**, not `page.request`. The login cookie only reaches the server through the browser page.
- **In CI these tests only report failures; they don't block merging.** To make them block, remove `continue-on-error: true` from the `e2e` job in `.github/workflows/ci.yml`.
