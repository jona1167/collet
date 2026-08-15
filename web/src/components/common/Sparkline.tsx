interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

/** Hand-rolled SVG sparkline — no chart lib. */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = "var(--chart-1)",
  className,
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.35"
        />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const innerH = height - pad * 2

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = pad + innerH - ((v - min) / range) * innerH
    return [x, y] as const
  })

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ")
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path d={area} fill={color} opacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}