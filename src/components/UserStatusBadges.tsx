import React from "react";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { cn } from "@/lib/utils";

type UserLike = {
  roles: string[];
  profile?: { facility?: string } | null;
};

interface UserStatusBadgesProps {
  user: UserLike;
  /** Display label for the user's facility (falls back to profile.facility). */
  facilityLabel?: string;
  /** Whether to show the "New" badge. */
  isNew?: boolean;
  className?: string;
  /** Suppress the facility badge (when showing facility as text metadata instead). */
  hideFacilityBadge?: boolean;
  /** Extra badges to render inside the same BadgeGroup, after the standard ones. */
  children?: React.ReactNode;
}

/**
 * Standard role/status badge cluster used in admin user lists.
 * Pass extra <Badge> children to have them join the same connected pill group.
 */
export function UserStatusBadges({
  user,
  facilityLabel,
  isNew = false,
  hideFacilityBadge = false,
  className,
  children,
}: UserStatusBadgesProps) {
  const isTester = user.roles.includes("tester");
  const isUser = user.roles.includes("user");

  return (
    <BadgeGroup className={cn(className)}>
      {isTester ? (
        <Badge variant="tester">Tester</Badge>
      ) : !hideFacilityBadge ? (
        <Badge variant="facility">
          {facilityLabel || user.profile?.facility || ""}
        </Badge>
      ) : null}
      {!isTester && isUser && <Badge variant="user">User</Badge>}
      {isNew && !isTester && isUser && <Badge variant="new">New</Badge>}
      {children}
    </BadgeGroup>
  );
}
