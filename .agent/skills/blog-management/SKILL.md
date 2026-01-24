---
name: blog-management
description: Comprehensive skill for managing the TwoPiggyHaveFun blog, including article syncing, location geocoding, and content management via API.
---

# Blog Management Skill

This skill provides the knowledge and procedures required to maintain and update the TwoPiggyHaveFun blog, which is built with Astro and hosted on GitHub Pages.

## Blog Architecture

- **Static Site**: Astro-based, rendered to static HTML.
- **Hosting**: GitHub Pages (`https://twopiggyhavefun.uk`).
- **Backend API**: Node.js servers running on Railway.
  - `article_api_server.js`: Handles CRUD operations for articles.
  - `blog_sync_server.js`: Orchestrates Pixnet synchronization and geocoding.
- **Content Storage**: Markdown files in `src/content/posts/*.md`.

## Metadata Schema (Frontmatter)

Every article MUST have a valid YAML frontmatter:
```yaml
title: "Article Title"
date: "YYYY-MM-DD"
category: "category-id"
tags: ["tag1", "tag2"]
coverImage: "/path/to/image.jpg"
pixnetId: "12345678" # Optional, for synced posts
address: "Physical Address" # Optional, for geocoding
location: # Optional, for map display
  lat: 25.0330
  lng: 121.5654
businessHours: "Mon-Sun 10:00-22:00" # Optional
```

## Procedures

### 1. Syncing with Pixnet
To sync latest articles from Pixnet:
1. Ensure `blog_sync_server.js` is running on Railway.
2. Trigger the sync via `POST /api/sync` on the Railway backend.
3. The server will fetch HTML from Pixnet, convert to Markdown, and save to `src/content/posts`.

### 2. Location Geocoding
For posts with an `address` but no `location`:
1. Use `scripts/geocode_and_update.js`.
2. This script calls the Nominatim API to find coordinates.
3. Updated coordinates are written back to the post's frontmatter.

### 3. Managing Articles via UI
Access the visual management interface at `/editor/`:
- **Auth**: Use the configured `AUTH_PASSWORD` (default: `asasas123`).
- **Features**: List, search, edit Markdown, and "Deploy" (triggers Git push).

## SEO and Content Guidelines

### Titles and Meta
- Titles: 10-60 characters, must include keywords (e.g., location name, food type).
- Slug: Use the Pixnet ID or date-based format (e.g., `20240124-title`).

### Media
- Cover Image: Required. Use the first high-quality image from the post.
- Alt Text: Always add descriptive alt text to images for accessibility and SEO.

### Categorization
- Be specific. Don't just use `travel`.
- If the post is about a restaurant in Taipei, use `taipei-food`.
- Map new Pixnet categories to the closest Astro equivalent in `CATEGORY_MAPPING`.

### Validation
- Run `node tests/verify_site.js --internal-only` after adding new content to check for broken links.
- Check that the `location` field is populated for business-related posts to ensure they appear on the site's map.

