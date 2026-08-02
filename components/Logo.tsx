interface LogoProps {
  size?: number;
}

export default function Logo({ size = 36 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="8" fill="#1C2B3A" />
      <rect x="8" y="8" width="4.5" height="24" rx="1" fill="#e5e7eb" />
      <path d="M12.5 8h8.5a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6h-8.5V8z" fill="#e5e7eb" />
      <path d="M19 20l8 12h-5.5l-7-10" stroke="#0D9A7A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="22" cy="14" r="5" fill="#f5f5f0" stroke="none" />
      <circle cx="22" cy="14" r="4" fill="none" stroke="#1C2B3A" strokeWidth="1.5" />
      <line x1="25.5" y1="17.5" x2="28" y2="20" stroke="#0D9A7A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="16" r="1.5" fill="#F59E0B" />
      <circle cx="2" cy="20" r="1.5" fill="#F59E0B" />
      <circle cx="4" cy="24" r="1.5" fill="#F59E0B" />
    </svg>
  );
}
