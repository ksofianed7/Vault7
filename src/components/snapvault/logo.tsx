"use client";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

export function VaultLogo({ size = 28, withWordmark = false, className }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Concentric vault door marks */}
        <rect x="6" y="6" width="20" height="20" rx="0.5" fill="none" stroke="#ff6b4a" strokeWidth="1.5" />
        <rect x="9.5" y="9.5" width="13" height="13" rx="0.5" fill="none" stroke="#e8c547" strokeWidth="0.75" opacity="0.5" />
        <rect x="13" y="13" width="6" height="6" fill="#ff6b4a" />
        {/* Tiny corner ticks — pro tool feel */}
        <path d="M6 9 L6 6 L9 6" stroke="#8a8474" strokeWidth="0.75" />
        <path d="M23 6 L26 6 L26 9" stroke="#8a8474" strokeWidth="0.75" />
        <path d="M26 23 L26 26 L23 26" stroke="#8a8474" strokeWidth="0.75" />
        <path d="M9 26 L6 26 L6 23" stroke="#8a8474" strokeWidth="0.75" />
      </svg>
      {withWordmark && (
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[18px] font-medium tracking-tight text-cream">
            Vault
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-warm">
            v.01
          </span>
        </div>
      )}
    </div>
  );
}
