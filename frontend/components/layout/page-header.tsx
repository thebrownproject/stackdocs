'use client'

import { Fragment, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Icons from '@/components/icons'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Map route segments to display labels
const segmentLabels: Record<string, string> = {
  documents: 'Documents',
  stacks: 'Stacks',
  settings: 'Settings',
  upload: 'Upload',
}

// Map route segments to icons
const segmentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  documents: Icons.Files,
  stacks: Icons.Stack3,
  settings: Icons.Settings,
  upload: Icons.Upload,
}

function formatSegment(segment: string): string {
  // Check for known label mapping
  if (segmentLabels[segment]) {
    return segmentLabels[segment]
  }
  // For UUIDs or IDs, show truncated version
  if (segment.length > 20) {
    return `${segment.slice(0, 8)}...`
  }
  // Default: capitalize first letter
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

interface PageHeaderProps {
  /** Override the last breadcrumb label (defaults to formatted URL segment) */
  title?: string
  /** Icon component for the last breadcrumb (e.g., file type icon) */
  icon?: ReactNode
  /** Action buttons to render on the right side */
  actions?: ReactNode
}

export function PageHeader({ title, icon, actions }: PageHeaderProps) {
  const pathname = usePathname()

  // Parse pathname into segments (filter out empty strings)
  const segments = pathname.split('/').filter(Boolean)

  // Build breadcrumb items with cumulative hrefs
  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const isLast = index === segments.length - 1
    const label = isLast && title ? title : formatSegment(segment)

    return { segment, href, label, isLast }
  })

  // Root route ('/') - no breadcrumbs shown (sidebar provides navigation)
  if (breadcrumbs.length === 0) {
    return actions ? (
      <div className="flex flex-1 items-center justify-end">
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    ) : null
  }

  return (
    <div className="flex flex-1 items-center justify-between">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((item, index) => {
            const Icon = segmentIcons[item.segment]

            return (
              <Fragment key={item.href}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {item.isLast ? (
                    <BreadcrumbPage className="flex items-center gap-1.5">
                      {icon || (Icon && <Icon className="size-4" />)}
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BreadcrumbLink asChild>
                          <Link href={item.href} className="flex items-center gap-1.5">
                            {Icon && <Icon className="size-4" />}
                            {item.label}
                          </Link>
                        </BreadcrumbLink>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Go to {item.label}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
