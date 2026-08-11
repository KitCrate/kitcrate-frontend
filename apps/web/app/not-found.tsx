import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-rivet bg-paper px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-charcoal/60">404</p>
      <h1 className="font-display text-3xl tracking-wide text-charcoal">This tag isn&apos;t on the board.</h1>
      <p className="max-w-sm text-sm text-charcoal/70">
        The page you are looking for does not exist, or the listing has been taken down.
      </p>
      <Link
        href="/"
        className="rounded-full bg-amber px-5 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-amber/90"
      >
        Back to browse
      </Link>
    </div>
  );
}
