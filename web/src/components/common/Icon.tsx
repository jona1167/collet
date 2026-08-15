import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function svgProps({ size = 16, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...rest,
  }
}

export const SearchIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14" />
  </svg>
)

export const PinIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M9.8 2.2 13.8 6.2 11.2 8.8 7.2 4.8 9.8 2.2Z" />
    <path d="M6.2 9.8 2.5 13.5" />
    <path d="M8.2 5.8 5.8 8.2" />
  </svg>
)

export const XIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M4 4 12 12M12 4 4 12" />
  </svg>
)

export const KillIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M5.5 8h5" />
  </svg>
)

export const RefreshIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
    <path d="M13.5 2.5v3h-3" />
  </svg>
)

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M4 6l4 4 4-4" />
  </svg>
)

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M6 4l4 4-4 4" />
  </svg>
)

export const SortIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M5 6l3-3 3 3M5 10l3 3 3-3" />
  </svg>
)

export const LayersIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M8 2 14 5 8 8 2 5 8 2Z" />
    <path d="M2 8l6 3 6-3" />
    <path d="M2 11l6 3 6-3" />
  </svg>
)

export const TableIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <rect x="2.5" y="3" width="11" height="10" rx="1" />
    <path d="M2.5 6.5h11M6.5 6.5V13" />
  </svg>
)

export const BookmarkIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M4 2.5h8v11L8 10.5 4 13.5v-11Z" />
  </svg>
)

export const CommandIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M6 4a2 2 0 1 0-2 2h8a2 2 0 1 0-2-2v8a2 2 0 1 0 2-2H4a2 2 0 1 0 2 2V4Z" />
  </svg>
)

export const ActivityIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M1.5 8h3l2-5 3 10 2-5h3" />
  </svg>
)

export const EyeIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
)

export const CollapseIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M10 3 5 8l5 5" />
  </svg>
)

export const ExpandIcon = (p: IconProps) => (
  <svg {...svgProps(p)}>
    <path d="M6 3l5 5-5 5" />
  </svg>
)