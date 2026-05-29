export function UserSectionHeader({
  title,
  count,
  description,
  className = "",
}: {
  title: string;
  count: number | string;
  description: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="font-display text-xl font-semibold">
        {title}{" "}
        <span className="text-muted-foreground font-normal">({count})</span>
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
