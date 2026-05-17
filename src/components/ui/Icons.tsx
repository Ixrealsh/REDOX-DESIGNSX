import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m20 20-4.2-4.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="10.7" cy="10.7" r="6.2" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

export function BagIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.5 8.2h11l1 12.3h-13L6.5 8.2Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 8.2V6.7a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path
        d="M12 20.2s-7.4-4.4-8.7-9.1C2.4 7.7 4.4 5 7.3 5c1.7 0 3.2.9 4.1 2.3C12.3 5.9 13.8 5 15.6 5c2.8 0 4.9 2.7 4 6.1-1.2 4.7-7.6 9.1-7.6 9.1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </IconBase>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 20c1.4-4 4-6 7.5-6s6.1 2 7.5 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 7h14M9 7V5h6v2M8 10v9M12 10v9M16 10v9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M7 7h10l-.8 14H7.8L7 7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 7h11v9H3V7ZM14 10h3.5l3 3v3H14v-6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="7" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

export function ReturnIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 7 5 11l4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M5 11h9a5 5 0 0 1 0 10h-2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 10h12v10H6V10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 10V7a3 3 0 1 1 6 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path
        d="m12 3 2.5 5.7 6.2.6-4.7 4.1 1.4 6.1-5.4-3.2-5.4 3.2 1.4-6.1-4.7-4.1 6.2-.6L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </IconBase>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="15" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

export function RulerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 16 16 4l4 4L8 20l-4-4Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m9 15-2-2m5-1-2-2m5-1-2-2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.5 12.8 15.5 17M15.5 7 8.5 11.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="6.5" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconBase>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="12" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path
        d="M7.2 4.5 9.7 7c.7.7.7 1.8 0 2.5l-.8.8a13 13 0 0 0 4.8 4.8l.8-.8c.7-.7 1.8-.7 2.5 0l2.5 2.5c.7.7.7 1.9-.1 2.5-1.1.9-2.5 1.2-3.9.7C10.5 18.4 5.6 13.5 4 8.5c-.5-1.4-.2-2.8.7-3.9.6-.8 1.8-.8 2.5-.1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </IconBase>
  );
}
