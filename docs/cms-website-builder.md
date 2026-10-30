# CMS / Website Builder API

The CMS stores structured page documents. Content is never interpreted as arbitrary HTML or JavaScript; the renderer maps allow-listed block types to trusted React components.

## School-scoped authoring

All authoring requests require a bearer token, `x-school-id`, and server-side `website.manage` or `website.publish` permission.

- `GET /api/v1/cms/templates` — active global templates.
- `GET /api/v1/cms/site` — current school website and page list.
- `POST /api/v1/cms/pages` — create a page with an initial immutable content version.
- `GET /api/v1/cms/pages/:pageId` — read page and its version history.
- `PUT /api/v1/cms/pages/:pageId` — save a new immutable page version.
- `POST /api/v1/cms/pages/:pageId/publish` — publish the latest saved version.
- `POST /api/v1/cms/pages/:pageId/rollback/:versionId` — publish a previous immutable version.

Supported block types in schema 1.0: hero, heading, rich_text, image, notice, and button. Documents are validated by Zod before storage. Page versions are append-only; publication records point to the exact version made public.

## Public rendering data

`GET /api/v1/public/schools/:schoolCode/pages/:slug` returns only a published page version for an active school and published site. It does not return draft content. Custom-domain verification and host-based routing remain separate deployment tasks.
