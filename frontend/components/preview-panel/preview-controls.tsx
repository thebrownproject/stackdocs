import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import * as Icons from '@/components/icons'

interface PreviewControlsProps {
  isPdfAvailable: boolean
  onExpand: () => void
  onDownload: () => void
  canDownload: boolean // Hide download button when no PDF URL available
}

export function PreviewControls({
  isPdfAvailable,
  onExpand,
  onDownload,
  canDownload,
}: PreviewControlsProps) {
  // Note: activeTab and onTabChange props removed - parent Tabs component
  // handles tab changes via onValueChange. TabsTrigger only needs value.
  return (
    <div className="flex items-center justify-between w-full">
      <TabsList className="h-7 p-0.5 bg-black/30">
        <TabsTrigger
          value="pdf"
          disabled={!isPdfAvailable}
          className="h-6 px-2.5 text-xs text-white/90 data-[state=active]:bg-white/20 data-[state=active]:text-white data-[disabled]:text-white/40"
        >
          PDF
        </TabsTrigger>
        <TabsTrigger
          value="text"
          className="h-6 px-2.5 text-xs text-white/90 data-[state=active]:bg-white/20 data-[state=active]:text-white"
        >
          Text
        </TabsTrigger>
      </TabsList>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-white hover:bg-white/20 hover:text-white"
          onClick={onExpand}
          aria-label="Expand preview"
        >
          <Icons.ArrowsMaximize className="size-4" />
        </Button>
        {canDownload && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white hover:bg-white/20 hover:text-white"
            onClick={onDownload}
            aria-label="Download document"
          >
            <Icons.Download className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
