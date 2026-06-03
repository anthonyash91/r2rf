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
  const baseClass = `inline-flex items-center leading-none gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-xs font-medium ${
    read ? "" : "border-input bg-background text-foreground"
  } ${className}`;

  const readStyle = read
    ? {
        color: "var(--color-accent)",
        backgroundColor: "color-mix(in oklab, var(--color-accent) 15%, transparent)",
        borderColor: "color-mix(in oklab, var(--color-accent) 30%, transparent)",
      }
    : undefined;

  // "circle" icon for interactive toggles (the user can click to mark read);
  // "x" for static status displays where the badge is informational only.
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

  // Render as a clickable <button> when the parent supplies an onClick handler;
  // otherwise render as a non-interactive <span>.
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} transition-colors cursor-pointer ${read ? "hover:opacity-90" : "hover:bg-muted"}`}
        style={readStyle}
      >
        {content}
      </button>
    );
  }

  return <span className={`${baseClass} flex-shrink-0`} style={readStyle}>{content}</span>;
}
