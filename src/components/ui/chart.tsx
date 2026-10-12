import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// shadcn/ui's chart: Recharts inside a container that names each series'
// colour as a CSS variable, so a chart takes the theme like any component.

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
    color?: string
  }
}

type ChartContextProps = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used within a <ChartContainer />")
  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-square justify-center text-xs [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-text]:fill-muted-foreground [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colored = Object.entries(config).filter(([, c]) => c.color)
  if (!colored.length) return null
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${colored.map(([key, c]) => `  --color-${key}: ${c.color};`).join("\n")}\n}`,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  className,
  hideLabel = false,
  label,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & { hideLabel?: boolean }) {
  const { config } = useChart()
  if (!active || !payload?.length) return null
  return (
    <div className={cn("grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl", className)}>
      {hideLabel ? null : <div className="font-medium">{label as React.ReactNode}</div>}
      {payload.map((item: { dataKey?: unknown; name?: unknown; value?: unknown }) => {
        const key = String(item.dataKey ?? item.name ?? "value")
        return (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{config[key]?.label ?? String(item.name ?? "")}</span>
            <span className="font-mono font-medium text-foreground tabular-nums">{String(item.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle }
