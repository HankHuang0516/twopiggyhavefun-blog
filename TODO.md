# Project TODOs

## One-off Bugs
- [ ] **UI Bug: Clickable Whitespace causing unintended navigation**
    - **Description**: Clicking on whitespace (margins, padding) in article pages triggers a link (likely to current page or home).
    - **Status**: Investigated by AI. No obvious unclosed `<a>` tags found in static HTML check.
    - **Potential Causes**:
        - CSS layering issue (z-index) where a link covers the content.
        - "Skip to main content" link might be styling incorrectly (AI added `.sr-only` fix to `Layout.astro` to mitigate).
        - JavaScript event listener bubbling or delegation on `body` or `main`.
    - **Next Steps**:
        - Inspect with browser DevTools (F12) when the issue occurs.
        - Check computed size of header links/logo.
