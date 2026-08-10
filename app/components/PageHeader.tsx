export default function PageHeader({ title }: { title: string }) {
  return (
    <header className="border-b-2 border-gold bg-navy px-8 py-5">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl tracking-wide text-parchment">
          {title}
        </h1>
      </div>
    </header>
  );
}