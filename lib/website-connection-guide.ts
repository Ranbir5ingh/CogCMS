/** Public setup instructions only. Never interpolate credentials into this template. */
export const developerConnectionPrompt = `Connect this existing website to our Content CMS. Keep its current design, URLs and unrelated features.

WEBSITE BRIEF — marketing fills what they know; report anything missing:
- Website name: [name]
- Public origin, including https and www if used: [https://www.example.com]
- Repository and working branch: [repository / branch]
- Framework, hosting provider and deployment owner: [details or inspect repository]
- Preview/staging origin: [URL]
- Content to manage: [blogs / authors / FAQs / whitepapers / release notes]
- Existing public paths: [blogs, FAQ, whitepapers, release notes; list unused types]
- Existing content source and what must be imported: [database / files / old CMS / none]
- Newsletter or FAQ submission forms to retain: [details / none]
- Publisher name, publisher URL, logo URL and locale: [details]
- Marketing editors and approver: [people to invite through the CMS administrator]

CMS CONFIGURATION — request these from the CMS administrator/operator:
- CMS origin: [your CMS origin, e.g. https://cms.example.com]
- Immutable CMS site ID and slug: [provided after site creation]
- Agreed content read mode: [Atlas published views; API alternative only if agreed]
- For Atlas: database name, exact seven view names and secret-manager reference for a site-restricted, find-only reader URI.
- For API reads: secret-manager reference for this site's content:read key.
- For forms: separate secret-manager reference for this site's intake:write key.
- Public media origin and media prefix: [operator-provided]
- Webhook signing-secret reference: [secret manager]
- Production and preview environment configuration: [separate credentials/targets as agreed]
Never paste actual keys, passwords, database URIs or signing secrets into chat, source code, logs or browser-visible environment variables.

FIRST, INSPECT AND REPORT
Inspect the repository instructions, framework/version, content reads, rendering, metadata, sitemap, forms, caching and deployment setup. Return a concise table: detail needed | observed value or missing | who must provide it. Do not invent values. Identify the exact files to change and an existing-content migration plan. Site creation, Atlas permissions and media provisioning are CMS operator work; do not assume they happen automatically. Ask only for details that block implementation.

THEN IMPLEMENT, WHEN THE DETAILS ARE AVAILABLE
1. Add a server-only content adapter using the agreed read mode. Keep the website's design and canonical URLs. Use the CMS's versioned contracts; ask for the CMS repository/contract files if unavailable. Keep a reversible switch to the existing content source until acceptance.
2. Atlas mode: read only cms_v1_<siteId>_site, _posts, _authors, _faqs, _whitepapers and _release_notes with the site's find-only user. Validate BSON data against contracts/mongo-v1 and map it to the website's existing types. Never use the CMS operator/runtime credential, raw editorial collections or database-wide read privileges. Do not create indexes or views from website code.
3. API mode: call /api/v1 server-side with Authorization: Bearer <site key>. GET /site; GET /posts, /authors, /faqs, /whitepapers, /release-notes; GET /posts/:slug, /authors/:slug, /whitepapers/:slug, /release-notes/:slug. Lists return {data, meta}; singles return {data}. Paginate all lists (page/limit, maximum limit 100). Use post summary fields for cards and the full post contract for articles. Inspect contracts/v1 and packages/cms-client; do not guess response fields.
4. Preserve stored blog rendering, images, author links, related content, SEO metadata, canonical URLs and sitemap entries. Import only the approved content, preserve slugs/dates/relationships, validate totals and rendered pages, and keep the original source recoverable. The optional legacy migration adapter requires its documented source schema and explicit target-site configuration; inspect it before importing another source.
5. Implement a POST webhook endpoint on the WEBSITE and return its exact HTTPS URL to the CMS administrator. Verify X-CMS-Timestamp (Unix seconds, within five minutes) and X-CMS-Signature (sha256=<hex>) as HMAC-SHA256 of timestamp + '.' + the unchanged raw request body, using constant-time comparison. Validate payload.siteId against the configured immutable site ID before invalidating anything. Handle content.published, content.updated, content.unpublished and content.deleted, including contentType site. Invalidate affected detail/list/related/metadata/sitemap caches; handle old and new slugs and site archival. The payload supplies only the current slug; use site/type-wide invalidation or a retained ID-to-old-slug mapping to clear the previous URL. Make retries safe. Use a bounded time-based cache expiry as fallback because webhook delivery is best effort with one retry. Errors must not become cached empty content; a genuinely missing document may return 404.
6. If forms are required, submit from the website server to POST /api/v1/intake/newsletter-subscriptions or /api/v1/intake/faq-submissions using intake:write. Check the input schemas in lib/validation and response schemas in contracts/v1/intake.ts. Validate requests and apply website-side abuse protection; handle validation errors, rate limits and outages honestly. Verify hosting-specific trusted client-IP handling against the CMS implementation. Do not put an API key in browser code or give the Atlas reader write access.
7. Configure the operator-provided media origin in the website's image policy where needed. Existing absolute image URLs must continue to work. CMS upload permissions are provisioned separately by its operator.
8. Test in preview: published content visible, drafts and other tenants absent; create/edit/publish/unpublish/rename/delete reflected on the website; author changes, image display, links, metadata and sitemap correct; invalid/stale/wrong-site webhooks rejected; forms persisted once per intended submission; recovery from a missed notification within the agreed cache limit. Verify mobile content pages without redesigning the site.
9. Return the code diff, tests/build results, required environment VARIABLE NAMES (no values), exact webhook URL, migration/parity report, deployment steps and rollback steps. Coordinate final import, preview acceptance, production deployment and switching the CMS webhook with the deployment owner. Do not delete the legacy source or retire its admin until the owner accepts the new flow.

HANDOFF
Give marketing the CMS login URL, assigned site, editable sections, public URLs to check, expected update delay and a named support contact. Explain any unsupported section or remaining blocker. A successful CMS save alone is not proof that the public website updated.`;
