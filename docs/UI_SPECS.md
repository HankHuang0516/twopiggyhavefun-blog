# UI Design Specifications

This document defines the strict UI/UX standards for the TwoPiggyBlog Editor.
Any changes to the frontend MUST adhere to these layers and logic.

## 1. Z-Index Layers (Global)
To prevent overlap issues, we use a strict Tier system.

| Tier | Range | Usage | Example |
| :--- | :--- | :--- | :--- |
| **System Overlay** | `9000+` | Critical Overlays | `loading-overlay` (9999), `login-view` (5000) |
| **Modal** | `2000-4000` | Temporary Dialogs | `flickr-modal` (2000) |
| **Navigation** | `1000-1999` | Permanent Nav | `.sidebar` (2000 - *Special Case: Fixed Top*) |
| **Header** | `100-999` | Contextual Headers | `.editor-header-nav` (100) |
| **Content** | `0-99` | Standard flow | `.editor-wrapper`, `.post-list` |

> **Critical Rule**: The `.sidebar` must have `z-index: 2000` or higher if it is to slide *over* the content on Mobile. On Desktop, it is `fixed` to the left.

## 2. Layout Structure

### **Sidebar (`.sidebar`)**
-   **Position**: `fixed`
-   **Placement**: `top: 0`, `bottom: 0`, `left: 0`
-   **Width**: `300px`
-   **Behavior**:
    -   **Mobile**: Hidden by default (`translateX(-100%)`). Slides in when toggled.
    -   **Desktop**: Always visible. Content pushes right.
-   **Feature**: content inside MUST include a "Collapse" button (`#sidebar-close-btn`).

### **Main Content (`.editor-wrapper` inside `.main-container`)**
-   **Margin**: `margin-left: 300px` (Desktop, Sidebar Open)
-   **Transition**: Smooth `0.3s` transition for margin changes.

## 3. UI Colors
| Variable | Code | Usage |
| :--- | :--- | :--- |
| `--primary` | `#2563eb` | Primary Actions, Links, Active States |
| `--text-main` | `#1e293b` | Headings, Body Text |
| `--border` | `#e2e8f0` | Dividers, Inputs |

## 4. Verification Check
Run `node tests/verify_layers.js` to strictly enforce the Z-Index rules defined above.
