# UI Components (shadcn/ui)

**Purpose:** Styled Radix UI primitives managed by shadcn/ui CLI - do not modify directly.

## Component Categories

| Category | Files | Description |
|----------|-------|-------------|
| **Overlays** | `dialog`, `alert-dialog`, `sheet`, `popover`, `tooltip` | Modal/popup patterns |
| **Menus** | `dropdown-menu`, `command` | Action menus, command palette |
| **Layout** | `card`, `resizable`, `separator`, `sidebar` | Content containers and dividers |
| **Forms** | `button`, `input`, `input-group`, `textarea`, `checkbox` | Form controls with variants |
| **Data** | `table`, `tabs`, `badge`, `avatar`, `skeleton` | Display components |
| **Navigation** | `breadcrumb` | Breadcrumb trail |
| **Feedback** | `sonner` | Toast notifications (via Sonner) |
| **Utilities** | `collapsible` | Expandable sections |

## Key Patterns

- **Radix primitives**: Most components wrap `@radix-ui/*` with Tailwind styling
- **CVA variants**: `button`, `badge`, `input-group` use `class-variance-authority` for variants
- **data-slot attributes**: All components include `data-slot` for debugging/styling hooks
- **Icons**: Import from `@/components/icons` barrel (never direct `@tabler/icons-react`)
- **Dark mode**: Components use CSS variables (`bg-background`, `text-foreground`, etc.)

## Common Variants

```tsx
// Button: default, destructive, outline, secondary, ghost, link
// Size: default, sm, lg, icon, icon-sm, icon-lg
<Button variant="outline" size="sm">Click</Button>

// Badge: default, secondary, destructive, outline
<Badge variant="secondary">Status</Badge>
```

## Do Not Modify

These files are shadcn managed. To update:
```bash
npx shadcn@latest add <component> --overwrite
```

Custom components belong in `components/<feature>/` or `components/shared/`.
