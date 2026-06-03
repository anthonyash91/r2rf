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
      {/* Tester badge takes the first slot exclusively — tester accounts don't
          belong to a facility, so the facility badge is omitted for them. */}
      {isTester ? (
        <Badge variant="tester" size="sm">Tester</Badge>
      ) : !hideFacilityBadge ? (
        <Badge variant="facility" size="sm">
          {facilityLabel || user.profile?.facility || ""}
        </Badge>
      ) : null}
      {!isTester && isUser && <Badge variant="user" size="sm">User</Badge>}
      {/* New badge only makes sense for regular users — not for testers. */}
      {isNew && !isTester && isUser && <Badge variant="new" size="sm">New</Badge>}
      {children}
    </BadgeGroup>
  );
}
