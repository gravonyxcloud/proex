import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-14">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[70vh] w-[70vw] -translate-x-1/2"
        style={{
          background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.16), transparent 65%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground shadow-glow">
            PX
          </span>
          <span className="font-display text-xl font-semibold">Proex</span>
        </Link>

        <div className="surface p-7 shadow-card sm:p-8">{children}</div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Acesso por API ao Claude Code. Não somos a Anthropic nem parceiros oficiais.
        </p>
      </div>
    </div>
  );
}
