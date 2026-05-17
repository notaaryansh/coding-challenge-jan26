import type {
  Fruit,
  FruitAttributes,
  FruitPreferences,
  NumberRange,
  ShineFactor,
} from "@/lib/matching";

interface FruitCardProps {
  fruit: Fruit;
  size?: "sm" | "md" | "lg";
  highlighted?: boolean;
  className?: string;
}

const SHINE_LABEL: Record<ShineFactor, string> = {
  dull: "Dull",
  neutral: "Neutral",
  shiny: "Shiny",
  extraShiny: "Extra shiny",
};

export function FruitCard({
  fruit,
  size = "md",
  highlighted = false,
  className = "",
}: FruitCardProps) {
  const isApple = fruit.type === "apple";
  const icon = isApple ? "🍎" : "🍊";
  const typeLabel = isApple ? "Apple" : "Orange";

  const padding = size === "sm" ? "p-3" : size === "lg" ? "p-6" : "p-4";
  const iconSize = size === "sm" ? "text-2xl" : size === "lg" ? "text-5xl" : "text-4xl";
  const titleSize = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg";

  const themeBg = highlighted
    ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-white ring-2 ring-emerald-200/60 dark:border-emerald-600 dark:from-emerald-950/40 dark:to-zinc-900 dark:ring-emerald-900/60"
    : isApple
      ? "border-red-200/80 bg-gradient-to-br from-red-50 to-white dark:border-red-900/40 dark:from-red-950/20 dark:to-zinc-900"
      : "border-orange-200/80 bg-gradient-to-br from-orange-50 to-white dark:border-orange-900/40 dark:from-orange-950/20 dark:to-zinc-900";

  return (
    <div
      className={`rounded-xl border shadow-sm transition ${padding} ${themeBg} ${className}`}
    >
      <header className="flex items-start gap-3">
        <span className={`leading-none ${iconSize}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className={`font-bold tracking-tight ${titleSize}`}>{typeLabel}</h3>
          <code className="mt-0.5 block truncate text-[10px] text-muted">
            {fruit.id}
          </code>
        </div>
      </header>

      <Section title="Attributes">
        <AttributesView attrs={fruit.attributes} />
      </Section>

      <Section title="Looking for">
        <PreferencesView prefs={fruit.preferences} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

export function AttributesView({ attrs }: { attrs: FruitAttributes }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {attrs.size !== null && <Stat label="Size" value={attrs.size.toString()} />}
        {attrs.weight !== null && <Stat label="Weight" value={`${attrs.weight} g`} />}
        {attrs.shineFactor && (
          <Stat label="Shine" value={SHINE_LABEL[attrs.shineFactor]} />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {attrs.hasStem !== null && <Pill label="Stem" present={attrs.hasStem} />}
        {attrs.hasLeaf !== null && <Pill label="Leaf" present={attrs.hasLeaf} />}
        {attrs.hasWorm !== null && (
          <Pill label="Worm" present={attrs.hasWorm} danger />
        )}
      </div>
    </div>
  );
}

function PreferencesView({ prefs }: { prefs: FruitPreferences }) {
  const hasAny = Object.values(prefs).some((v) => v !== undefined);
  if (!hasAny) {
    return <p className="text-xs italic text-muted">Open to anything.</p>;
  }
  return (
    <ul className="space-y-1">
      {prefs.size && <Wish>Size {formatRange(prefs.size)}</Wish>}
      {prefs.weight && <Wish>Weight {formatRange(prefs.weight, " g")}</Wish>}
      {prefs.shineFactor && (
        <Wish>
          Shine:{" "}
          {Array.isArray(prefs.shineFactor)
            ? prefs.shineFactor.map((s) => SHINE_LABEL[s]).join(" or ")
            : SHINE_LABEL[prefs.shineFactor]}
        </Wish>
      )}
      {prefs.hasStem !== undefined && (
        <Wish>{prefs.hasStem ? "With stem" : "No stem"}</Wish>
      )}
      {prefs.hasLeaf !== undefined && (
        <Wish>{prefs.hasLeaf ? "With leaf" : "No leaf"}</Wish>
      )}
      {prefs.hasWorm !== undefined && (
        <Wish important={!prefs.hasWorm}>
          {prefs.hasWorm ? "Doesn't mind a worm" : "No worms"}
        </Wish>
      )}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

function Pill({
  label,
  present,
  danger,
}: {
  label: string;
  present: boolean;
  danger?: boolean;
}) {
  const colors = present
    ? danger
      ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300"
      : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300"
    : "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-500";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${colors}`}
    >
      <span aria-hidden>{present ? "✓" : "✗"}</span>
      {label}
    </span>
  );
}

function Wish({
  children,
  important,
}: {
  children: React.ReactNode;
  important?: boolean;
}) {
  return (
    <li className="flex items-start gap-1.5 text-sm">
      <span
        className={
          important
            ? "text-rose-500 dark:text-rose-400"
            : "text-zinc-400 dark:text-zinc-600"
        }
      >
        ›
      </span>
      <span className={important ? "font-medium" : ""}>{children}</span>
    </li>
  );
}

function formatRange(range: NumberRange, unit = ""): string {
  if (range.min !== undefined && range.max !== undefined) {
    return `${range.min}${unit} – ${range.max}${unit}`;
  }
  if (range.min !== undefined) return `≥ ${range.min}${unit}`;
  if (range.max !== undefined) return `≤ ${range.max}${unit}`;
  return "any";
}
