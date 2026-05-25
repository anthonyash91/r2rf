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
}

/**
 * Standard role/status badge cluster used in admin user lists:
 * Tester | Facility | User | New (the "New" badge only renders for the
 * regular `user` role per the project's existing rule).
 */
export function UserStatusBadges({
  user,
  facilityLabel,
  isNew = false,
  className,
}: UserStatusBadgesProps) {
  const isTester = user.roles.includes("tester");
  const isUser = user.roles.includes("user");

  return (
    <BadgeGroup className={cn(className)}>
      {isTester ? (
        <Badge variant="tester">Tester</Badge>
      ) : (
        <Badge variant="facility">
          {facilityLabel || user.profile?.facility || ""}
        </Badge>
      )}
      {!isTester && isUser && <Badge variant="user">User</Badge>}
      {isNew && !isTester && isUser && <Badge variant="new">New</Badge>}
    </BadgeGroup>
  );
}
