# Published Mongo view contract v1

Status: local implementation, not yet deployed. Definition and allowlists: `lib/publishing/views.ts`; security tests: `lib/publishing/views.test.ts`.

Namespaces are `cms_v1_<canonical-site-ObjectId>_<kind>`. ObjectIds and dates remain BSON values at this boundary; the website adapter validates and converts them to existing public response types. Namespace versioning isolates future breaking schema changes.

| Kind          | Source        | Public data                                                                                                                      |
| ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| site          | sites         | Identity, public paths, publisher, locale, media prefix, updatedAt                                                               |
| posts         | blogs         | Card/SEO fields, published dates, author ID, related slugs, explicit FAQ/TOC fields, stored rendered HTML/TOC/read-time snapshot |
| events        | events        | Event content, schedule, venue, registration link, speakers, and SEO fields |
| authors       | authors       | Public profile and explicit x/linkedin/website social URLs                                                                       |
| faqs          | faqs          | Question, answer, category, order, createdAt, updatedAt                                                                          |
| whitepapers   | whitepapers   | Public metadata and content needed to derive public blocks                                                                       |
| release_notes | release_notes | Version, release date, intro, explicit section/item fields, updatedAt                                                            |

All content views match the immutable site ID and exact `status: 'publish'`, then require an active owning site. The site view itself matches the fixed ID and `active`. Views end with inclusion projections, including nested fields: new editorial fields do not become public implicitly. No view contains CMS users, keys, intake, webhook secrets, audit actor fields or raw blog editor content.

For author joins, query only the same site's author view. A missing/draft/other-site author resolves to null. Related selection operates only over the site's published post view. Existing absolute media URLs stay unchanged; configure the public media origin separately from secrets.

Website database users receive only the `find` privileges returned by `readerPrivileges(database, siteId)`. Do not assign database-wide `read`/`readWrite`. Runtime CMS users get collection-scoped CRUD privileges on editorial/auth/intake collections; view/index/user management belongs to the operator. Normal view reads require no access to source collections, even for the active-site lookup.

## Operator provisioning

Use an operator identity with view-management privileges and explicit `MONGODB_URI`/`MONGODB_DB_NAME` through a secure environment. Commands never accept a URI/password as an argument:

```sh
npm run ensure:published-views -- --site <site-ObjectId>
npm run ensure:published-views -- --site <site-ObjectId> --write
```

Default is dry-run. The command validates the site and preflights all seven names before creating missing views. Identical existing definitions are unchanged; an ordinary collection, different source/pipeline or non-simple collation causes refusal. It never drops or modifies existing definitions. Output contains names/actions and reader privilege specifications, never credentials. Database-user creation is a separate Atlas operator action.

Serialize operator runs: a concurrent creator may cause a later create to fail after earlier new views were created. Rerun safely; do not imply an atomic seven-view transaction. A known preflight collision causes no writes. Versioned view changes require a reviewed reconciliation/migration, not `--force`.

Create source collections and indexes with the operator before runtime traffic. Provision a site's views and restricted user before onboarding its website; the CMS editor does not create Atlas users. Preview and production have separate databases/users, even for identical site IDs.

The CMS runtime also needs collection-scoped CRUD on `intake_rate_limits`, never granted to website readers. Shared intake limits use an Atlas replica-set transaction over the IP and API-key buckets; a standalone Mongo server is not a supported runtime for intake. `ensure:indexes` provisions this collection's `expiresAt` TTL index before traffic. The runtime neither creates indexes nor manages views/users. Expiry is storage cleanup, not the admission clock: limits refill continuously, with both buckets debited atomically or neither debited.

Archival/unpublish removes rows from subsequent database reads. Existing website caches require signed invalidation or expiry; database filtering alone does not erase cached pages. Database errors must not be disguised as empty results. Validate live Atlas roles and Vercel behavior before release; local Mongo tests are not cloud acceptance.
