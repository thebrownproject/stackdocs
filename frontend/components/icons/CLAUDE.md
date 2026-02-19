# Icons

**Purpose:** Centralized barrel export for Tabler icons with stripped prefixes for cleaner usage throughout the app.

## Files

| File | Description |
|------|-------------|
| `index.ts` | Re-exports ~50 Tabler icons with `Icon` prefix removed (e.g., `IconCheck` -> `Check`) |

## Key Patterns

- **Never import directly**: Always use `@/components/icons`, never `@tabler/icons-react`
- **Namespace import**: Use `import * as Icons from "@/components/icons"` for discoverability
- **Type export**: `Icon` type available for component props
- **Organized by category**: Icons grouped by purpose (navigation, files, actions, etc.)

## Usage

```tsx
// Component usage
import * as Icons from "@/components/icons"

<Icons.Check className="size-4" />
<Icons.Upload className="size-5" />

// Type usage for props
import type { Icon } from "@/components/icons"

interface Props {
  icon: Icon
}
```

## Adding New Icons

1. Find the icon name in [@tabler/icons-react](https://tabler.io/icons)
2. Add to `index.ts` in the appropriate category section
3. Strip the `Icon` prefix in the alias (e.g., `IconNewIcon as NewIcon`)

## Icon Categories

| Category | Examples |
|----------|----------|
| Checkmarks/validation | `Check`, `Circle`, `AlertCircle` |
| Navigation | `ChevronRight`, `ChevronDown`, `ArrowUp` |
| Actions | `X`, `DotsHorizontal`, `Plus`, `Refresh` |
| Files/documents | `FileText`, `Upload`, `Download`, `Folder` |
| Layout/panels | `PanelLeft`, `PanelRight`, `SlidersHorizontal` |
| Theme | `Sun`, `Moon`, `DeviceDesktop` |
| Data | `Table`, `Clock`, `Calendar` |
