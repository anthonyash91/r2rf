import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FacilityOption = {
  value: string;
  label: string;
  disabled?: boolean;
  suffix?: string;
};

export function FacilityCombobox({
  value,
  onChange,
  options,
  placeholder = "Select a facility",
  searchPlaceholder = "Search facilities...",
  emptyMessage = "No facility found.",
  className,
  triggerClassName,
  allowClear,
  clearLabel = "All facilities",
}: {
  value: string;
  onChange: (value: string) => void;
  options: FacilityOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.value === value);
  const display = sel ? sel.label : (allowClear ? clearLabel : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm font-normal hover:bg-muted/40",
            triggerClassName,
          )}
        >
          <span className={cn(!sel && !allowClear && "text-muted-foreground", "truncate text-left")}>
            {display}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", className)} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value={clearLabel}
                  onSelect={() => { onChange(""); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  {clearLabel}
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  disabled={o.disabled}
                  onSelect={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className={cn(o.disabled && "text-muted-foreground")}>
                    {o.label}{o.suffix ? ` ${o.suffix}` : ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
