import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined, currency = "NGN"): string {
  if (amount === null || amount === undefined) return "₦0.00";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0.00%";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-NG", options ?? { day: "2-digit", month: "short", year: "numeric" });
}

export function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-NG", { month: "long" });
}

export function isPositive(value: number | null | undefined): boolean {
  return (value ?? 0) >= 0;
}
