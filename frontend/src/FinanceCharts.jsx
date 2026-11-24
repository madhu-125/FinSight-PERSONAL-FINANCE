import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export function CashFlowChart({
  data,
  gradientId,
  currencyFormatter,
  yAxisFormatter,
  yAxisWidth,
  tooltipContentStyle,
  tooltipLabelFormatter,
  strokeWidth,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`${gradientId}IncomeGradient`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9b7bff" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#9b7bff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gradientId}ExpenseGradient`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38d9b2" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#38d9b2" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#292d40" strokeDasharray="4 5" vertical={false} />
        <XAxis dataKey="label" stroke="#777d94" tickLine={false} axisLine={false} />
        <YAxis
          stroke="#777d94"
          tickLine={false}
          axisLine={false}
          tickFormatter={yAxisFormatter}
          width={yAxisWidth}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value, name) => [currencyFormatter(value), name === "income" ? "Income" : "Expenses"]}
          labelFormatter={tooltipLabelFormatter}
        />
        <Area
          type="monotone"
          dataKey="income"
          name="income"
          stroke="#a78bfa"
          fill={`url(#${gradientId}IncomeGradient)`}
          strokeWidth={strokeWidth}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          name="expenses"
          stroke="#38d9b2"
          fill={`url(#${gradientId}ExpenseGradient)`}
          strokeWidth={strokeWidth}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SpendingCategoryChart({
  data,
  innerRadius,
  outerRadius,
  paddingAngle,
  tooltipContentStyle,
  currencyFormatter,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={paddingAngle}
          stroke="none"
        >
          {data.map((category) => (
            <Cell key={category.name} fill={category.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value) => currencyFormatter(value)}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
