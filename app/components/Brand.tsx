import Image from "next/image";

// IRMS emblem: a scan frame around a check mark (original artwork for this app)
export function IrmsMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#003057" stroke="#C9A227" strokeWidth="2" />
      <path
        d="M13 19v-4a2 2 0 0 1 2-2h4M29 13h4a2 2 0 0 1 2 2v4M35 29v4a2 2 0 0 1-2 2h-4M19 35h-4a2 2 0 0 1-2-2v-4"
        stroke="#FAF9F6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18.5 24.5l4 4 7.5-8.5"
        stroke="#C9A227"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StakeLogo({ size = 56, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/oke-ata-logo.png"
      alt="Institute of Religion, Abeokuta Oke-Ata Stake"
      width={size}
      height={size}
      priority={priority}
      className="rounded-full"
    />
  );
}