# Landing Page Plan

## Goal

Build a Linear/Raycast-style landing page for Stackdocs - dark mode, polished, modern SaaS aesthetic.

## Aesthetic Reference

- **Linear** ([linear.app](https://linear.app)) - Dark background, bold typography, floating UI mockups, subtle shadows
- **Raycast** ([raycast.com](https://raycast.com)) - Gradient glows, glassmorphism, smooth animations

### Key Design Elements

- Dark background (#000 or near-black)
- Large, bold white typography
- Subtle gradient glows/blurs
- Floating product screenshots with realistic shadows
- Glassmorphism cards (subtle borders, translucent backgrounds)
- Smooth scroll animations

## Tech Stack

### Component Libraries (Free)

| Library | Purpose | Link |
|---------|---------|------|
| **Magic UI** | Animated React/Tailwind components | [magicui.design](https://magicui.design) |
| **Aceternity UI** | Fancy animated components (spotlight, gradients) | [ui.aceternity.com](https://ui.aceternity.com) |

### Paid Templates (Optional)

- **Luxe** (~$49) - Framer template
- **Cruip SaaS** ($79) - Has dark variants

## Proposed Workflow

1. **Start with a base template** - Either a paid Framer/Cruip template or build from scratch with Tailwind
2. **Add Aceternity UI components** - Spotlight effects, gradient blurs, bento grids
3. **Add Magic UI components** - Additional animated elements
4. **Customize** - Colors, copy, product screenshots
5. **Deploy** - Separate from app, to `www.stackdocs.io`

## Deployment Strategy

| Subdomain | Content |
|-----------|---------|
| `www.stackdocs.io` | Marketing landing page |
| `app.stackdocs.io` | The actual application |

## Status

**Not started** - Focus on completing the app first, then tackle the landing page.

## Notes

- Landing page will likely be a separate repo or folder to keep concerns separated
- Can use Next.js (same tech as app) or simpler static site
- Priority: finish app features before marketing polish
