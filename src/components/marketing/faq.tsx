import { FAQ } from '@/lib/constants';

export function FaqAccordion() {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card/60">
      {FAQ.map((item) => (
        <details key={item.p} className="group px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-sm font-medium text-foreground transition hover:text-primary [&::-webkit-details-marker]:hidden">
            {item.p}
            <span
              aria-hidden
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition group-open:rotate-45 group-open:border-primary/50 group-open:text-primary"
            >
              +
            </span>
          </summary>
          <p className="pb-6 text-sm leading-relaxed text-muted-foreground">{item.r}</p>
        </details>
      ))}
    </div>
  );
}
