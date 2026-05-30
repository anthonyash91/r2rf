import { Check, Circle, X } from "lucide-react";

export function ReadStatusBadge({
  read,
  readLabel,
  unreadLabel,
  unreadIcon = "x",
  readAt,
  onClick,
  className = "",
}: {
  read: boolean;
  readLabel: string;
  unreadLabel: string;
  /** Which icon to show for the unread state. "circle" for interactive toggles, "x" for status displays. */
  unreadIcon?: "circle" | "x";
  readAt?: string | null;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  const baseClass = `inline-flex items-center leading-none gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-xs font-medium ${
    read
      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-background"
      : "border-input bg-background text-foreground"
  } ${className}`;

  const UnreadIcon = unreadIcon === "circle" ? Circle : X;

  const content = read ? (
    <>
      <Check className="h-3.5 w-3.5" />
      {readLabel}
      {readAt && <> on {readAt}</>}
    </>
  ) : (
    <>
      <UnreadIcon className="h-3.5 w-3.5" />
      {unreadLabel}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} transition-colors cursor-pointer ${read ? "hover:opacity-90" : "hover:bg-muted"}`}
      >
        {content}
      </button>
    );
  }

  return <span className={`${baseClass} flex-shrink-0`}>{content}</span>;
}
