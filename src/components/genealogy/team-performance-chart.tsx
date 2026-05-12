
"use client"

import { Bar, BarChart, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart";
import { useI18n } from '@/lib/internationalization';

const chartConfig = {
  left: {
    label: "Left Team PV",
    color: "hsl(var(--chart-1))",
  },
  right: {
    label: "Right Team PV",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

interface TeamPerformanceChartProps {
    leftData: number;
    rightData: number;
}

export default function TeamPerformanceChart({ leftData, rightData }: TeamPerformanceChartProps) {
  const { t } = useI18n();
  const chartData = [
    { team: "Left", pv: leftData, fill: "var(--color-left)" },
    { team: "Right", pv: rightData, fill: "var(--color-right)" },
  ];
  
  return (
    <Card className="w-full">
      <CardHeader className="p-4 pb-0">
        <CardTitle>{t('genealogy.teamPerformance')}</CardTitle>
        <CardDescription>
            {t('genealogy.teamPerformanceDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 pt-2">
        <ChartContainer config={chartConfig} className="h-[120px] w-full">
          <BarChart 
            accessibilityLayer 
            data={chartData} 
            layout="vertical"
            margin={{
              left: 10,
              right: 10,
            }}
          >
            <YAxis
              dataKey="team"
              type="category"
              tickLine={false}
              axisLine={false}
              tick={{ dy: 2 }}
              className="font-bold"
            />
            <XAxis type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar 
              dataKey="pv" 
              radius={8}
              barSize={32}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
