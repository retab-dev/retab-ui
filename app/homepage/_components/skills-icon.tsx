import type { SVGProps } from "react";

export function SkillsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 26 26"
      fill="none"
      {...props}
    >
      <path
        d="M13 0L24.2583 6.5V19.5L13 26L1.74167 19.5V6.5L13 0ZM13 3L4.33975 8V18L13 23L21.6603 18V8L13 3Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
      <path
        d="M13 6L19.0622 9.5V16.5L13 20L6.93782 16.5V9.5L13 6Z"
        fill="currentColor"
      />
    </svg>
  );
}
