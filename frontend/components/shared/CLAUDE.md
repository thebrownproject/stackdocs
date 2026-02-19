# Shared Components

**Purpose:** Reusable UI components used across multiple features (documents, stacks).

## Files

| File | Description |
|------|-------------|
| `file-type-icon.tsx` | Renders file type icon based on MIME type (PDF, image, generic) |
| `stack-badges.tsx` | Displays stack membership badges with overflow handling |
| `stack-picker-content.tsx` | Searchable stack list for dropdown menus (+ `useStacksAvailable` hook) |
| `stack-picker-sub.tsx` | Dropdown submenu wrapper for stack picker with empty state |

## Key Patterns

- **Server/Client split**: `file-type-icon` and `stack-badges` are server components; picker components use `'use client'`
- **Composable pickers**: `StackPickerContent` handles the list UI, `StackPickerSub` wraps it as a dropdown submenu
- **Checkbox toggle mode**: Pass `selectedStackIds` Set to show checkboxes for multi-select behavior
- **Auto-focus search**: Picker content auto-focuses input when `isOpen` becomes true

## Usage

- `FileTypeIcon`: Document tables/lists to show PDF/image icons
- `StackBadges`: Document table rows showing which stacks contain a document
- `StackPickerSub`: Document row action menus for "Add to Stack" functionality
- `StackPickerContent`: Can be used standalone in any dropdown/popover for stack selection
