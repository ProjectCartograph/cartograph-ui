"use client"

import * as React from "react"
import { cn } from "cn"
import { tracePicker } from "@/trace"
import { CheckIcon, PlusIcon, ChevronDownIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandSeparator,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * The searchable picker, built on the Popover and Command this kit already
 * ships.
 *
 * It used to be the Base UI combobox, the one component in an otherwise
 * Radix kit. That mix is what made every dropdown inside a dialog dead to
 * the mouse: Radix's modal Dialog sets `pointer-events: none` on the body
 * and hands it back only to its own layer, and Base UI portals its popup
 * to the body, outside that layer. The list rendered, every item in it
 * computed `pointer-events: none`, and a click went through to the dialog
 * behind it, which closed the list without picking anything. Radix's own
 * Popover is part of the same dismissable-layer stack as the Dialog, so
 * the topmost layer gets its pointer events back wherever it is opened.
 */
export interface ComboboxOption {
  value: string
  label: string
}

function matches(option: ComboboxOption, search: string) {
  return option.label.toLowerCase().includes(search.trim().toLowerCase())
}

/** The trigger, dressed as the form field it replaces rather than as a
 * button: same height, border and focus ring as an Input, so a row of
 * pickers and inputs still lines up. */
function Trigger({
  className,
  contentClassName,
  children,
  empty,
  onClear,
  clearLabel,
  disabled,
  ...props
}: React.ComponentProps<"button"> & {
  empty: boolean
  onClear?: () => void
  clearLabel?: string
  /** Classes for the row the children sit in. The trigger's own
   * className dresses the button; a caller that needs its content to
   * wrap has to say so here, because the button's flex-wrap governs the
   * button's children and the content is one of them. */
  contentClassName?: string
}) {
  return (
    <div className="relative flex w-full min-w-0 items-center">
      <PopoverTrigger
        data-slot="combobox-trigger"
        role="combobox"
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent bg-clip-padding py-1 pl-2.5 text-left text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          onClear && !empty ? "pr-14" : "pr-8",
          className
        )}
        {...props}
      >
        {/* No `truncate` here: this is a flex container, and on one of
            those it does nothing at all — the text is an anonymous flex
            item with no block box for text-overflow to act on, so it
            overflows and the parent clips it mid-word instead. Whoever
            puts content in wears the ellipsis on a block of their own.
            ComboboxMultiple's chips already do (they wrap, and a single
            truncating wrapper would collapse them into one line). */}
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1",
            empty && "text-muted-foreground",
            contentClassName
          )}
        >
          {children}
        </span>
      </PopoverTrigger>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 pr-1.5">
        {onClear && !empty ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="pointer-events-auto"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
          >
            <XIcon />
          </Button>
        ) : null}
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </div>
    </div>
  )
}

function List({
  options,
  onAdd,
  addLabel,
  searchPlaceholder,
  emptyText,
  isSelected,
  onPick,
}: {
  options: ComboboxOption[]
  /** Offered at the foot of the list when the thing wanted is not in it. */
  onAdd?: () => void
  addLabel?: string
  searchPlaceholder?: string
  emptyText: string
  isSelected: (value: string) => boolean
  onPick: (value: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const shown = React.useMemo(
    () => (search.trim() ? options.filter((o) => matches(o, search)) : options),
    [options, search]
  )

  return (
    // cmdk filters on its own by default, on a score it computes from the
    // item's text; the options here carry their own label and nothing else,
    // so the plain substring match above is both enough and predictable.
    <Command shouldFilter={false} data-slot="combobox-command">
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={searchPlaceholder}
      />
      <CommandList>
        <CommandEmpty>{emptyText}</CommandEmpty>
        {shown.map((option) => (
          <CommandItem
            key={option.value}
            value={option.value}
            data-slot="combobox-item"
            onSelect={() => onPick(option.value)}
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {isSelected(option.value) ? (
              <CheckIcon className="ml-auto size-4 shrink-0" />
            ) : null}
          </CommandItem>
        ))}
        {/* An action, not another option: marked and quiet, below a rule,
            so a list of nouns does not swallow a verb. Something thought
            of while filling a field must not cost the field. */}
        {onAdd ? (
          <>
            {shown.length > 0 ? <CommandSeparator className="my-1" /> : null}
            <CommandItem
              value="__combobox_add__"
              data-slot="combobox-add"
              className="text-muted-foreground"
              onSelect={onAdd}
            >
              <PlusIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{addLabel}</span>
            </CommandItem>
          </>
        ) : null}
      </CommandList>
    </Command>
  )
}

/** Pick one. `value` is the picked option's value, or undefined. */
function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel,
  className,
  disabled,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "data-cartograph-field": field,
  onAdd,
  addLabel,
}: {
  options: ComboboxOption[]
  value: string | undefined
  onValueChange: (next: string | undefined) => void
  /** Adds one that does not exist yet, at the foot of the list. */
  onAdd?: () => void
  addLabel?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyText: string
  /** Read out for the X that empties the field; omitted means no X. */
  clearLabel?: string
  className?: string
  disabled?: boolean
  "aria-label"?: string
  "aria-invalid"?: boolean
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string
}) {
  const [open, setOpen] = React.useState(false)
  // An id the register no longer holds still shows as itself, rather than
  // leaving the field looking empty while it holds a value.
  const picked = value ? (options.find((o) => o.value === value) ?? { value, label: value }) : null

  return (
    <Popover open={open} onOpenChange={tracePicker(setOpen)}>
      <Trigger
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        data-cartograph-field={field}
        disabled={disabled}
        empty={!picked}
        className={className}
        onClear={clearLabel ? () => onValueChange(undefined) : undefined}
        clearLabel={clearLabel}
      >
        {/* The ellipsis lives on a block of its own. The trigger's slot is
            a flex row, and `truncate` on a flex container does nothing at
            all: the text is an anonymous flex item with no block box for
            text-overflow to act on, so it overflows and the trigger clips
            it mid-word — "Education Management Infor", with nothing to say
            there was more (Programme Lead, 2026-09-27). */}
        <span className="min-w-0 flex-1 truncate">
          {picked ? picked.label : placeholder}
        </span>
      </Trigger>
      <PopoverContent
        data-slot="combobox-content"
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-56 gap-0 p-0"
      >
        <List
          options={options}
          searchPlaceholder={searchPlaceholder ?? placeholder}
          emptyText={emptyText}
          isSelected={(v) => v === value}
          onPick={(v) => {
            onValueChange(v === value ? undefined : v)
            setOpen(false)
          }}
          onAdd={onAdd ? () => { setOpen(false); onAdd() } : undefined}
          addLabel={addLabel}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Pick several. The trigger carries the picked ones as chips, each with
 * its own remove, and the list stays open between picks. */
function ComboboxMultiple({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  removeLabel,
  onAdd,
  addLabel,
  className,
  disabled,
  "aria-label": ariaLabel,
  "data-cartograph-field": field,
}: {
  options: ComboboxOption[]
  value: string[]
  onValueChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText: string
  /** Read out for a chip's own X. */
  removeLabel?: (label: string) => string
  /** Make the thing that is not in the list yet, without leaving the field. */
  onAdd?: () => void
  addLabel?: string
  className?: string
  disabled?: boolean
  "aria-label"?: string
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string
}) {
  const [open, setOpen] = React.useState(false)
  const picked = value.map((v) => options.find((o) => o.value === v) ?? { value: v, label: v })

  function toggle(v: string) {
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }

  return (
    <Popover open={open} onOpenChange={tracePicker(setOpen)}>
      <Trigger
        aria-expanded={open}
        aria-label={ariaLabel}
        data-cartograph-field={field}
        disabled={disabled}
        empty={picked.length === 0}
        className={cn("h-auto min-h-8 py-1", className)}
        // The chips wrap, and until 2026-09-29 the class that said so was
        // on the button rather than on the row they are in: two long
        // names then ran a quarter of the way out of the card
        // (Programme Lead, 2026-09-29).
        contentClassName="flex-wrap"
      >
        {picked.length === 0
          ? placeholder
          : picked.map((o) => (
              <span
                key={o.value}
                data-slot="combobox-chip"
                className="flex h-[calc(--spacing(5.25))] max-w-full min-w-0 items-center gap-0.5 rounded-sm bg-muted pl-1.5 text-xs font-medium whitespace-nowrap text-foreground"
              >
                <span className="truncate">{o.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-50 hover:opacity-100"
                  aria-label={removeLabel?.(o.label)}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(o.value)
                  }}
                >
                  <XIcon />
                </Button>
              </span>
            ))}
      </Trigger>
      <PopoverContent
        data-slot="combobox-content"
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-56 gap-0 p-0"
      >
        <List
          options={options}
          searchPlaceholder={searchPlaceholder ?? placeholder}
          emptyText={emptyText}
          isSelected={(v) => value.includes(v)}
          onPick={toggle}
          onAdd={onAdd ? () => { setOpen(false); onAdd(); } : undefined}
          addLabel={addLabel}
        />
      </PopoverContent>
    </Popover>
  )
}

export { Combobox, ComboboxMultiple }
