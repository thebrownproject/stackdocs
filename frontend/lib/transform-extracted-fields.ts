export type DataShape =
  | 'primitive'
  | 'key-value'
  | 'string-array'
  | 'grouped-arrays'
  | 'object-array'

export interface ExtractedFieldRow {
  id: string
  field: string
  value: unknown
  displayValue: string
  confidence?: number
  dataShape: DataShape
  subRows?: ExtractedFieldRow[]
  depth: number
  // Properties for object-array rendering
  _columns?: string[]
  _values?: unknown[]
}

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')
}

function isObjectArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
  )
}

function isGroupedArrays(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((v) => isStringArray(v))
}

function isKeyValueObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((v) => isPrimitive(v))
}

export function detectDataShape(value: unknown): DataShape {
  if (isPrimitive(value)) return 'primitive'
  if (isStringArray(value)) return 'string-array'
  if (isObjectArray(value)) return 'object-array'
  if (isGroupedArrays(value)) return 'grouped-arrays'
  if (isKeyValueObject(value)) return 'key-value'
  // Default to key-value for complex nested objects
  return 'key-value'
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function getSummary(value: unknown, shape: DataShape): string {
  switch (shape) {
    case 'primitive':
      if (value === null || value === undefined) return '—'
      return String(value)
    case 'string-array':
      return `${(value as string[]).length} items`
    case 'object-array':
      return `${(value as object[]).length} items`
    case 'grouped-arrays': {
      const categories = Object.keys(value as object).length
      return `${categories} categories`
    }
    case 'key-value': {
      const fields = Object.keys(value as object).length
      return `${fields} fields`
    }
    default:
      return ''
  }
}

function transformKeyValue(
  obj: Record<string, unknown>,
  parentId: string,
  depth: number
): ExtractedFieldRow[] {
  return Object.entries(obj).map(([key, val]) => ({
    id: `${parentId}-${key}`,
    field: formatFieldName(key),
    value: val,
    displayValue: isPrimitive(val) ? (val === null ? '—' : String(val)) : '',
    dataShape: 'primitive' as DataShape,
    depth,
  }))
}

function transformStringArray(arr: string[], parentId: string, depth: number): ExtractedFieldRow[] {
  // Return single row with joined values for inline display
  return [
    {
      id: `${parentId}-items`,
      field: '',
      value: arr,
      displayValue: arr.join(' · '),
      dataShape: 'string-array' as DataShape,
      depth,
    },
  ]
}

function transformGroupedArrays(
  obj: Record<string, string[]>,
  parentId: string,
  depth: number
): ExtractedFieldRow[] {
  return Object.entries(obj).map(([key, arr]) => ({
    id: `${parentId}-${key}`,
    field: formatFieldName(key),
    value: arr,
    displayValue: arr.join(' · '),
    dataShape: 'string-array' as DataShape,
    depth,
  }))
}

function transformObjectArray(
  arr: Record<string, unknown>[],
  parentId: string,
  depth: number
): ExtractedFieldRow[] {
  // Get all unique keys from objects
  const allKeys = [...new Set(arr.flatMap((obj) => Object.keys(obj)))]

  return arr.map((obj, index): ExtractedFieldRow => ({
    id: `${parentId}-${index}`,
    field: allKeys.map((k) => obj[k]).join(' | '),
    value: obj,
    displayValue: '',
    dataShape: 'primitive' as DataShape,
    depth,
    // Store columns for table rendering
    _columns: allKeys,
    _values: allKeys.map((k) => obj[k]),
  }))
}

export function transformExtractedFields(
  fields: Record<string, unknown> | null,
  confidenceScores: Record<string, number> | null
): ExtractedFieldRow[] {
  // Validate fields object
  if (!fields || typeof fields !== 'object') return []

  return Object.entries(fields)
    .filter(([, value]) => value !== undefined) // Skip undefined values
    .map(([key, value]) => {
    const shape = detectDataShape(value)
    const confidence = confidenceScores?.[key]

    const row: ExtractedFieldRow = {
      id: key,
      field: formatFieldName(key),
      value,
      displayValue: getSummary(value, shape),
      confidence,
      dataShape: shape,
      depth: 0,
    }

    // Add subRows for expandable content
    if (shape === 'key-value') {
      row.subRows = transformKeyValue(value as Record<string, unknown>, key, 1)
    } else if (shape === 'string-array') {
      row.subRows = transformStringArray(value as string[], key, 1)
    } else if (shape === 'grouped-arrays') {
      row.subRows = transformGroupedArrays(value as Record<string, string[]>, key, 1)
    } else if (shape === 'object-array') {
      row.subRows = transformObjectArray(value as Record<string, unknown>[], key, 1)
    }

    return row
  })
}
