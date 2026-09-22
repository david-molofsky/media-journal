import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/** Compact goal-and-ball mark for completed Dashboard goals. Kept as
 * a vector so it stays consistent across platforms and remains clear
 * at the small size used on summary cards. */
export function GoalAchievedIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.25 19.25V6.75h17.5v12.5" />
        <path d="M3.25 6.75 6 10h12l2.75-3.25M6 10v9.25M18 10v9.25" />
        <path d="M9 10v3.2M15 10v3.2M6 13.2h12M6 16.3h3.1M14.9 16.3H18" />
        <circle cx="12" cy="16" r="3" fill="currentColor" fillOpacity="0.18" />
        <path
          d="m10.75 15.55 1.25-.9 1.25.9-.48 1.45h-1.54Z"
          fill="currentColor"
          stroke="none"
        />
      </g>
    </SvgIcon>
  );
}
