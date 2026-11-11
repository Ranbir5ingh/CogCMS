# Architecture

The Next.js application serves the admin UI, authenticated admin API, and versioned `/api/v1` publishing API. MongoDB stores users, sites and content. Every content record has a `siteId`. The admin session's current site is resolved server-side; client input cannot select another site's records. API keys bind to one site and have separate read/intake scopes.

Blogs are rendered and sanitized on save; published snapshots are returned through `/api/v1`. The public website owns its design and routes. The admin editor preview is approximate. Media upload is optional and disabled when S3 configuration is absent.

`GET /api/admin/blogs` currently fetches every full blog for the active site. The Blogs page then searches and filters that array in the browser. Server-side pagination is an improvement opportunity described in the optional [assignment](../ASSIGNMENT.md).

Events are site-scoped content with the same admin, published-only `/api/v1/events` and per-site MongoDB view boundaries as other content. Posts carry optional cover image alt text (`imageAlt`), an additive `/api/v1` change (`X-CMS-Version: 1.1`).

Optional publishing and media integrations support installations beyond the local demo. Deployment tools require explicit operator targets. The legacy website importer is an optional adapter for a specific source schema, not a universal importer. Private installation records and company content are excluded from the public distribution.
