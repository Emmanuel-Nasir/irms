import { AnimatedBackground } from "@/app/components/Motion";

export default function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="irms-gradient-pan relative overflow-hidden border-b-2 border-gold bg-gradient-to-r from-navy via-navy-light to-navy px-6 py-6 sm:px-8">
      <AnimatedBackground tone="dark" fixed={false} shapes={false} />
      <div className="relative z-10 mx-auto max-w-4xl">
        <h1 className="irms-enter-left font-display text-2xl tracking-wide text-parchment">{title}</h1>
        {subtitle && (
          <p className="irms-enter-left mt-1 text-sm text-parchment/70" style={{ animationDelay: "0.1s" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="irms-shimmer-bar absolute inset-x-0 bottom-0 h-0.5" />
    </header>
  );
}
