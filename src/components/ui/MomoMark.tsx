type Props = {
  size?: number;
  className?: string;
  steam?: boolean;
};

/** Hand-drawn pleated momo brand mark. */
export function MomoMark({ size = 40, className = '', steam = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      {steam && (
        <>
          <path className="steam-line s1" d="M30 16 C27.5 12 32.5 10 30 5" />
          <path className="steam-line s2" d="M40 16 C42.5 12 37.5 10 40 5" />
        </>
      )}
      <path d="M36 21 C46.8 21 57 32.4 57 43.5 C57 52.6 47.6 58.5 36 58.5 C24.4 58.5 15 52.6 15 43.5 C15 32.4 25.2 21 36 21 Z" />
      <path d="M36 23 C33 26.5 29 28.6 24.8 30.4" />
      <path d="M36 23 C34.4 27.6 31 31.8 26.4 35.4" />
      <path d="M36 23 C39 26.5 43 28.6 47.2 30.4" />
      <path d="M36 23 C37.6 27.6 41 31.8 45.6 35.4" />
    </svg>
  );
}
