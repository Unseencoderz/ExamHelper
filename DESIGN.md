---
name: ExamHelper Signal Console
description: A quiet, precise desktop control surface for a personal background utility.
colors:
  canvas-default: "#0D1117"
  canvas-subtle: "#010409"
  canvas-overlay: "#161B22"
  canvas-raised: "#21262D"
  border-default: "#30363D"
  border-muted: "#21262D"
  fg-default: "#C9D1D9"
  fg-muted: "#8B949E"
  fg-subtle: "#6E7681"
  accent-fg: "#58A6FF"
  accent-canvas: "#1F6FEB"
  success-fg: "#3FB950"
  success-canvas: "#238636"
  danger-fg: "#FF7B72"
  danger-canvas: "#DA3633"
  attention-fg: "#FFA657"
  # selection overlay uses accent-canvas at 30% opacity (#1F6FEB/30)
typography:
  body:
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.875rem"          # 14px base
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    # Used for: shortcuts, timestamps, filenames, clipboard content, nav labels, badge counts, breadcrumbs
rounded:
  control: "8px"
  surface: "12px"
  badge: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.success-canvas}"     # #238636
    hoverColor: "#2ea043"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    height: "40px"
    padding: "8px 12px"
  button-secondary:
    backgroundColor: "{colors.canvas-overlay}"      # #161B22
    hoverColor: "{colors.canvas-raised}"            # #21262D
    textColor: "{colors.fg-default}"
    borderColor: "{colors.border-default}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  button-danger:
    hover-border: "{colors.danger-canvas}/60"       # #DA3633 at 60%
    hover-text: "{colors.danger-fg}"                # #FF7B72
  sidebar:
    collapsed-width: "64px"                         # w-16
    expanded-width: "256px"                         # w-64
    background: "{colors.canvas-subtle}"            # #010409
    border: "{colors.border-default}"
    active-item-bg: "{colors.canvas-overlay}"
    active-item-text: "#ffffff"
    active-accent-bar: "{colors.accent-canvas}"     # 2px left rule, #1F6FEB
    inactive-text: "{colors.fg-muted}"
  badge-unread:
    backgroundColor: "{colors.accent-canvas}"       # #1F6FEB
    textColor: "#ffffff"
    fontFamily: mono
    fontSize: "9px"
    maxValue: "9+"
    ring: "{colors.canvas-subtle}"                  # ring-2 ring-[#010409]
  desktop-indicator:
    online-dot: "{colors.success-fg}"               # #3FB950 + ping animation
    online-bg: "{colors.success-canvas}/20"
    online-border: "{colors.success-canvas}/60"
    offline-dot: "{colors.fg-subtle}"               # #6E7681
    offline-bg: "{colors.canvas-overlay}"
    offline-border: "{colors.border-default}"
---

# Design System: ExamHelper Signal Console

## Overview

**Creative North Star: "Signal Console"**

ExamHelper is a quiet instrument panel for a background utility: information stays close to the surface, states are unmistakable, and the interface gets out of the way of focused work. The system favors compact, structured rows and split work areas over dashboard cards or marketing-style panels.

The design is deliberately dark because it is used alongside desktop work, often for long sessions. Color is rare and functional: blue names active interaction, green confirms a live desktop link, and muted red protects irreversible actions. The one expressive cue is a contained pulse on a real-time status update, never an ambient animation.

**Key Characteristics:**

- GitHub-dark graphite layers and hairline structure
- Dense, scan-first information layout
- Plus Jakarta Sans body; JetBrains Mono reserved for factual data
- Motion only for user-caused or live state change

## Colors

The palette is a GitHub dark-mode derivation. All tokens are registered as Tailwind v4 `@theme` CSS custom properties in `web-app/src/index.css`.

### Canvas / Surface

| Token | Value | Use |
|---|---|---|
| `canvas-default` | `#0D1117` | Page background |
| `canvas-subtle` | `#010409` | Sidebar background, deepest surface |
| `canvas-overlay` | `#161B22` | Cards, active nav items, input fields |
| `canvas-raised` | `#21262D` | Hover state, secondary surfaces |
| `border-default` | `#30363D` | Standard hairline borders |
| `border-muted` | `#21262D` | Subtle dividers, inner borders |

### Foreground

| Token | Value | Use |
|---|---|---|
| `fg-default` | `#C9D1D9` | Primary text |
| `fg-muted` | `#8B949E` | Secondary labels, inactive nav |
| `fg-subtle` | `#6E7681` | Placeholders, least-emphasis text |

### State Colors (Signal-Only Rule)

| Token | Value | Use |
|---|---|---|
| `accent-fg` | `#58A6FF` | Active nav icon, focus outline, link text |
| `accent-canvas` | `#1F6FEB` | Unread badges, active sidebar accent bar, selection ring |
| `success-fg` | `#3FB950` | Desktop ONLINE dot and text |
| `success-canvas` | `#238636` | Primary action buttons (Submit, Save, Archive confirm) |
| `danger-fg` | `#FF7B72` | Destructive hover text |
| `danger-canvas` | `#DA3633` | Destructive hover border |
| `attention-fg` | `#FFA657` | Warning toasts, Caps Lock notice |

**The Signal-Only Rule.** Accent and status color communicate interaction or state; they never decorate a neutral region.

## Typography

**Body:** Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif  
**Mono:** JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace

Monospace is used for: keyboard shortcuts, timestamps, filenames, clipboard content, nav section labels, badge counts, breadcrumb hierarchy, and version strings. It is not used as a decorative or brand element.

### Hierarchy

- **Title:** bold, tracking-tight, `text-white` — used for the current work area heading only.
- **Body:** `fg-default`, 14px base, compact and high-legibility.
- **Label / Meta:** `fg-muted` or `fg-subtle`, `text-xs`, often monospace.

## Layout

The shell is a two-column layout: a sticky persistent sidebar on the left, a scrollable main work plane on the right. A sticky top header spans the work plane only.

**Sidebar** defaults to a 64px icon-only rail on first visit; the user can expand it to 256px via a toggle. The preference persists in `localStorage`. On mobile (below `md` breakpoint), the sidebar becomes an off-canvas drawer triggered by a hamburger button in the top header.

**Main work plane** uses a `max-w-7xl` centered container with `px-4 sm:px-8 py-6` padding. Dashboard and Archive use compact screenshot rows. Snippets and Clipboard use structured two-panel work areas.

## Elevation & Depth

Depth comes from canvas steps and `border-default` hairline rules, not box shadows. Dialogs and menus use `shadow-2xl` when detaching from the work plane. The sidebar uses a right `border-r border-[#30363D]` only.

## Shapes

- Controls: 8px (`rounded-md`)
- Surfaces (cards, dialog containers): 12px (`rounded-xl`)
- Badges: fully rounded (`rounded-full`)
- Sidebar nav items: 8px (`rounded-lg`)

## Components

### Sidebar Navigation

- **Rail (collapsed):** 64px wide, icons only, `justify-center py-2.5`, tooltip on hover.
- **Rail (expanded):** 256px wide, icon + label, `px-2.5 py-2`, count/unread badges on right.
- **Active item:** `bg-[#161B22] text-white border border-[#30363D]` + 4px `w-1` Signal Blue leading rule on the left edge.
- **Inactive item:** `text-[#8B949E] hover:bg-[#161B22]/70`.
- **Unread badge (collapsed):** absolute-positioned pill at icon corner, `bg-[#1F6FEB]`, ring `#010409`, max `9+`.
- **Unread badge (expanded):** inline pill on the right, same color.
- **Count badge (no unread):** plain mono text `#6E7681` on the right.

### Desktop Status Indicator

- **ONLINE:** green dot (`#3FB950`) with `animate-ping` ghost ring, `bg-[#238636]/20 border-[#238636]/60 text-[#3FB950]` pill.
- **OFFLINE:** static gray dot (`#6E7681`), `bg-[#161B22] border-[#30363D] text-[#8B949E]` pill.
- One short ping animation fires each time the actual connection state changes; there is no ambient animation while stable.

### Buttons

- **Primary (constructive):** `bg-[#238636] hover:bg-[#2ea043] text-white`, 8px radius, 40px min height.
- **Secondary:** `bg-[#21262D] border border-[#30363D] text-[#C9D1D9]`, neutral hover.
- **Destructive hover:** `hover:border-[#DA3633]/60 hover:text-[#FF7B72]` — border and text change on hover; background stays neutral until confirmation.
- **Copy → Checkmark:** inline icon swap (Copy → Check) on success; no toast; 1800ms reset.

### Inputs / Fields

- Background: `#0D1117` (canvas-default, inset feel).
- Border: `#30363D` default → `#58A6FF` on focus.
- Focus ring: `ring-1 ring-[#58A6FF]/40`.
- Error state: `border-[#DA3633] ring-[#DA3633]/40`.

### Toasts

Four variants with accent-canvas color coding: `default` (neutral), `success` (green), `danger` (red), `warning` (orange). Auto-dismiss after 4 seconds. Not used for copy events (inline icon swap only).

### Dialogs (ConfirmDialog)

Modal overlay, `rounded-xl`, `shadow-2xl`, `bg-[#161B22] border border-[#30363D]`. Destructive confirms use `danger-canvas` button; non-destructive use `success-canvas`.

## Do's and Don'ts

### Do:

- **Do** use the named canvas, fg, and state tokens for every surface and label.
- **Do** preserve clear action names, real selection states, and keyboard focus (`outline: 2px solid #58A6FF`).
- **Do** use compact rows for screenshot collections with dozens of entries.
- **Do** swap icons inline (copy → check) for non-destructive, reversible confirmations.

### Don't:

- **Don't** introduce hero copy, feature-card scaffolding, or decorative gradient backgrounds.
- **Don't** use color, animation, or monospace as generic visual decoration.
- **Don't** hide destructive intent behind unlabeled controls.
- **Don't** add toast notifications for copy events — use the inline icon swap only.
