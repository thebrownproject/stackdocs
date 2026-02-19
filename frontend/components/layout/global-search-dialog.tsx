"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import * as Icons from "@/components/icons"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

interface GlobalSearchDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = React.useState(false)

  // Use controlled or uncontrolled state
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [isOpen, setIsOpen])

  const runCommand = React.useCallback((command: () => void) => {
    setIsOpen(false)
    command()
  }, [setIsOpen])

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput placeholder="Search documents, pages, or actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/documents"))}
          >
            <Icons.Files className="size-4" />
            <span>Documents</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/extractions"))}
          >
            <Icons.LayersLinked className="size-4" />
            <span>Extractions</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/stacks"))}
          >
            <Icons.Stack className="size-4" />
            <span>Stacks</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(() => {
              // TODO: Trigger upload dialog
              console.log("Open upload dialog")
            })}
          >
            <Icons.Upload className="size-4" />
            <span>Upload Document</span>
          </CommandItem>
          <CommandItem disabled>
            <Icons.Settings className="size-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
