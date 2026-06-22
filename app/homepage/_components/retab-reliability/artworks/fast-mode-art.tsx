export function FastModeArt() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center px-4 pb-4 pt-2">
        <div className="relative aspect-[1.15] w-full max-w-sm">
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 320 260"
          >
            <path
              d="M52 164a108 108 0 0 1 216 0"
              fill="none"
              stroke="var(--border)"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <path
              d="M80 164a80 80 0 0 1 160 0"
              fill="none"
              stroke="var(--border)"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <path
              d="M66 164a94 94 0 0 1 48-82"
              fill="none"
              stroke="var(--success)"
              strokeLinecap="round"
              strokeWidth="6"
            />
            <path
              d="M114 82a94 94 0 0 1 92 0"
              fill="none"
              stroke="var(--warning)"
              strokeLinecap="round"
              strokeWidth="6"
            />
            <path
              d="M206 82a94 94 0 0 1 48 82"
              fill="none"
              stroke="var(--color-orange-500)"
              strokeLinecap="round"
              strokeWidth="6"
            />
            <path
              className="retab-router-arc"
              d="M66 164a94 94 0 0 1 188 0"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="5"
            />
            <circle
              className="retab-router-dot"
              cx="254"
              cy="164"
              fill="var(--background)"
              r="9"
              stroke="currentColor"
              strokeWidth="4"
            />
            <line
              x1="160"
              x2="160"
              y1="56"
              y2="92"
              stroke="var(--border)"
              strokeWidth="3"
            />
            <line
              x1="96"
              x2="122"
              y1="84"
              y2="110"
              stroke="var(--border)"
              strokeWidth="3"
            />
            <line
              x1="224"
              x2="198"
              y1="84"
              y2="110"
              stroke="var(--border)"
              strokeWidth="3"
            />
          </svg>

          <div className="border-border bg-background text-foreground absolute bottom-[18%] left-1/2 min-w-36 -translate-x-1/2 rounded-sm border px-4 py-2 text-center font-mono text-lg leading-none font-medium tracking-widest uppercase shadow-sm">
            Model
            <br />
            Router
          </div>
        </div>
      </div>
      <style>{`
        .retab-router-arc {
          color: var(--warning);
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: retab-router-arc 3.2s ease-in-out infinite;
        }

        .retab-router-dot {
          color: var(--warning);
          transform-origin: 160px 164px;
          animation: retab-router-dot 3.2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .retab-router-arc,
          .retab-router-dot {
            animation: none;
          }

          .retab-router-arc {
            stroke-dashoffset: 0;
          }
        }

        @keyframes retab-router-arc {
          0%,
          8% {
            stroke-dashoffset: 300;
          }
          58%,
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes retab-router-dot {
          0%,
          8% {
            transform: rotate(-180deg);
          }
          58%,
          100% {
            transform: rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}
