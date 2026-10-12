// Animated SVG donut chart.
//
// Adapted from the shadcn/TSX reference component to this project's stack:
//  - plain JSX (no TypeScript)
//  - shared `cn` helper from src/lib/utils
//  - project theme colors instead of shadcn CSS variables (--border etc.)
//
// Each segment needs `value`, `color` and `label`. Hovering a segment can be
// observed through `onSegmentHover`, and the centre can render any node via
// `centerContent`.
import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

const DonutChart = React.forwardRef(function DonutChart(
  {
    data = [],
    totalValue: propTotalValue,
    size = 200,
    strokeWidth = 20,
    animationDuration = 1,
    animationDelayPerSegment = 0.05,
    highlightOnHover = true,
    centerContent,
    onSegmentHover,
    className,
    ...props
  },
  ref,
) {
  const [hoveredSegment, setHoveredSegment] = React.useState(null)

  const internalTotalValue = React.useMemo(
    () => propTotalValue || data.reduce((sum, segment) => sum + segment.value, 0),
    [data, propTotalValue],
  )

  const radius = size / 2 - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  let cumulativePercentage = 0

  // Notify the parent whenever the internal hover state changes.
  React.useEffect(() => {
    onSegmentHover?.(hoveredSegment)
  }, [hoveredSegment, onSegmentHover])

  const handleMouseLeave = () => setHoveredSegment(null)

  return (
    <div
      ref={ref}
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        {/* Base background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />

        {/* Data segments */}
        <AnimatePresence>
          {data.map((segment, index) => {
            if (segment.value === 0) return null

            const percentage =
              internalTotalValue === 0 ? 0 : (segment.value / internalTotalValue) * 100
            const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
            const strokeDashoffset = (cumulativePercentage / 100) * circumference
            const isActive = hoveredSegment?.label === segment.label

            cumulativePercentage += percentage

            return (
              <motion.circle
                key={segment.label || index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-strokeDashoffset}
                strokeLinecap="round"
                initial={{ opacity: 0, strokeDashoffset: circumference }}
                animate={{ opacity: 1, strokeDashoffset: -strokeDashoffset }}
                transition={{
                  opacity: { duration: 0.3, delay: index * animationDelayPerSegment },
                  strokeDashoffset: {
                    duration: animationDuration,
                    delay: index * animationDelayPerSegment,
                    ease: 'easeOut',
                  },
                }}
                className={cn('origin-center transition-transform duration-200', highlightOnHover && 'cursor-pointer')}
                style={{
                  filter: isActive ? `drop-shadow(0px 0px 6px ${segment.color}) brightness(1.1)` : 'none',
                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                  transition: 'filter 0.2s ease-out, transform 0.2s ease-out',
                }}
                onMouseEnter={() => setHoveredSegment(segment)}
              />
            )
          })}
        </AnimatePresence>
      </svg>

      {/* Centre content */}
      {centerContent && (
        <div
          className="pointer-events-none absolute flex flex-col items-center justify-center"
          style={{ width: size - strokeWidth * 2.5, height: size - strokeWidth * 2.5 }}
        >
          {centerContent}
        </div>
      )}
    </div>
  )
})

DonutChart.displayName = 'DonutChart'

export { DonutChart }
export default DonutChart
