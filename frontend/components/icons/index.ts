// Re-export Tabler icons with stripped prefixes for cleaner usage
//
// Usage:
//   import * as Icons from "@/components/icons"
//   <Icons.Check className="size-4" />
//
// Type imports:
//   import type { Icon } from "@/components/icons"

export {
  // Checkmarks & validation
  IconCheck as Check,
  IconCircle as Circle,
  IconAlertCircle as AlertCircle,

  // Navigation & chevrons
  IconChevronRight as ChevronRight,
  IconChevronDown as ChevronDown,
  IconChevronLeft as ChevronLeft,
  IconChevronUp as ChevronUp,
  IconArrowUp as ArrowUp,
  IconArrowDown as ArrowDown,
  IconSelector as ChevronsUpDown,

  // Close & actions
  IconX as X,
  IconDots as DotsHorizontal,
  IconDotsVertical as DotsVertical,
  IconGripVertical as GripVertical,
  IconQuestionMark as QuestionMark,

  // Layout & panels
  IconLayoutSidebar as PanelLeft,
  IconLayoutSidebarRight as PanelRight,
  IconAdjustmentsHorizontal as SlidersHorizontal,
  IconArrowsMaximize as ArrowsMaximize,

  // Search
  IconSearch as Search,

  // Files & documents
  IconFileText as FileText,
  IconFileTypePdf as FileTypePdf,
  IconFiles as Files,
  IconPhoto as Image,
  IconUpload as Upload,
  IconFolder as Folder,
  IconFolderPlus as FolderPlus,
  IconDownload as Download,
  IconFileExport as FileExport,
  IconCsv as Csv,
  IconJson as Json,
  IconEdit as Edit,
  IconFilter2 as Filter,

  // App-specific
  IconStack2 as Stack,
  IconStack3 as Stack3,
  IconFileStack as FileStack,
  IconLayersIntersect as Layers,
  IconLayersLinked as LayersLinked,
  IconSettings as Settings,
  IconLifebuoy as Lifebuoy,
  IconSend as Send,
  IconShare as Share,
  IconTrash as Trash,
  IconBrandDatabricks as BrandDatabricks,

  // Theme
  IconSun as Sun,
  IconMoon as Moon,
  IconDeviceDesktop as DeviceDesktop,

  // Loading
  IconLoader2 as Loader2,

  // Actions
  IconPlus as Plus,
  IconRefresh as Refresh,

  // Data
  IconTable as Table,
  IconClock as Clock,
  IconCalendar as Calendar,
  IconCalendarMinus as CalendarMinus,
  IconCalendarEvent as CalendarEvent,
  IconCalendarWeek as CalendarWeek,
  IconCalendarMonth as CalendarMonth,

  // Filter
  IconFilterOff as FilterOff,
  IconFilter2Exclamation as FilterExclamation,
  IconFilter2X as FilterX,

  // Lists
  IconList as List,
  IconListDetails as ListDetails,
} from "@tabler/icons-react"

// Re-export the Icon type for component props
export type { Icon } from "@tabler/icons-react"
