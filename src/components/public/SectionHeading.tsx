export function SectionHeading({
  eyebrow,
  title,
  description,
  light = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  light?: boolean;
}) {
  return (
    <div>
      {eyebrow ? <p className={`somos-badge ${light ? "somos-badge-light" : ""}`}>{eyebrow}</p> : null}
      <h2 className={`somos-heading mt-4 ${light ? "text-white" : "text-[var(--somos-navy)]"}`}>{title}</h2>
      {description ? (
        <p className={`mt-4 max-w-2xl text-base font-medium leading-7 ${light ? "text-white/70" : "somos-muted"}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
