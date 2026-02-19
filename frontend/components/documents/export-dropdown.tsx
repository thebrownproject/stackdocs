'use client'

import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'

interface ExportDropdownProps {
  filename: string
  extractedFields: Record<string, unknown> | null
}

/**
 * Flatten a nested object into dot-notation keys.
 * e.g., { a: { b: 1 } } => { "a.b": 1 }
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey))
    } else if (Array.isArray(value)) {
      // Convert arrays to JSON string representation
      result[newKey] = value.map((v) => String(v)).join('; ')
    } else if (value === null || value === undefined) {
      result[newKey] = ''
    } else {
      result[newKey] = String(value)
    }
  }

  return result
}

/**
 * Escape a value for CSV (handles commas, quotes, newlines)
 */
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Convert extracted fields to CSV format
 */
function toCSV(data: Record<string, unknown>): string {
  const flattened = flattenObject(data)
  const keys = Object.keys(flattened)
  const values = Object.values(flattened)

  const headerRow = keys.map(escapeCSVValue).join(',')
  const valueRow = values.map(escapeCSVValue).join(',')

  return `${headerRow}\n${valueRow}`
}

/**
 * Generate filename with date suffix
 */
function generateFilename(originalFilename: string, extension: 'csv' | 'json'): string {
  // Remove existing extension from original filename
  const baseName = originalFilename.replace(/\.[^/.]+$/, '')
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  return `${baseName}_extraction_${date}.${extension}`
}

/**
 * Trigger a browser download of the given content
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ExportDropdown({ filename, extractedFields }: ExportDropdownProps) {
  const isDisabled = !extractedFields
  const tooltipText = isDisabled
    ? 'No extraction data available'
    : 'Download extraction data'

  const handleExportCSV = () => {
    if (!extractedFields) return

    try {
      const csvContent = toCSV(extractedFields)
      const exportFilename = generateFilename(filename, 'csv')
      downloadFile(csvContent, exportFilename, 'text/csv;charset=utf-8;')
      toast.success('CSV exported')
    } catch (error) {
      console.error('CSV export failed:', error)
      toast.error('Failed to export CSV')
    }
  }

  const handleExportJSON = () => {
    if (!extractedFields) return

    try {
      const jsonContent = JSON.stringify(extractedFields, null, 2)
      const exportFilename = generateFilename(filename, 'json')
      downloadFile(jsonContent, exportFilename, 'application/json')
      toast.success('JSON exported')
    } catch (error) {
      console.error('JSON export failed:', error)
      toast.error('Failed to export JSON')
    }
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ActionButton icon={<Icons.FileExport />} disabled={isDisabled}>
              Export
            </ActionButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipText}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
        <DropdownMenuItem onSelect={handleExportCSV} className="gap-2">
          <Icons.Csv className="size-4" />
          <span>Export as CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleExportJSON} className="gap-2">
          <Icons.Json className="size-4" />
          <span>Export as JSON</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
