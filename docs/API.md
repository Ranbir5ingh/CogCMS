# Connect a website

Create a site in the CMS and keep its immutable ID and slug with the website's server configuration. The CMS owns editing and publication; your website owns layout, URLs and caching.

## HTTP API

Create a site API key from **Sites → Edit → API keys**. Plaintext is shown once. Keep the key server-side. Use `content:read` for content and a separate `intake:write` key for forms.

```sh
curl -H "Authorization: Bearer $CMS_API_KEY" "$CMS_ORIGIN/api/v1/posts?limit=20&fields=summary"
curl -H "Authorization: Bearer $CMS_API_KEY" "$CMS_ORIGIN/api/v1/posts/example-post?include=author,related,jsonLd"
```

Events are available at `/api/v1/events` and `/api/v1/events/<slug>`. Posts include `imageAlt` (cover image alt text, empty string when unset); responses carry `X-CMS-Version: 1.1`.

Lists return `{data, meta}` with page/limit metadata; singles return `{data}`. Only published records for that key's site are returned. Read the schemas under `contracts/v1` for exact fields. `packages/cms-client` provides the typed fetch client; `npm run sync:client -- <target-directory>` copies it and the contract into a consumer.

## MongoDB views

For server-side MongoDB consumers, provision the seven per-site published views and a find-only reader identity using the [versioned view contract](../contracts/mongo-v1/README.md). Never give a website the CMS runtime or operator identity. Browser code must not contain a database URI.

## Changes and intake

Configure the website's webhook URL in the CMS site settings. Verify the timestamp and HMAC over the unchanged request bytes before invalidating caches. Webhooks are best effort with one retry; use bounded cache expiry as a fallback. The dashboard's **Connect a website** guide contains the full implementation checklist.

Newsletter and FAQ submissions use `/api/v1/intake/*` through your website server with `intake:write`. Follow the input schemas and trusted visitor-IP requirements in the implementation. Show validation failures, rate limits and outages to the user instead of reporting false success.
