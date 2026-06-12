import { Badge } from "@/components/Badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function FacilityBadge({ facilities, facilityLabelMap, className }: {
  facilities: string[];
  facilityLabelMap: Record<string, string>;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="cursor-default inline-flex p-0 m-0 h-auto w-auto border-none bg-transparent shadow-none leading-none"
        >
          <Badge variant="facility" className={className}>
            {facilities.length === 1
              ? (facilityLabelMap[facilities[0]] ?? facilities[0])
              : `${facilities.length} facilities`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {facilities.map((v) => facilityLabelMap[v] ?? v).join("; ")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
