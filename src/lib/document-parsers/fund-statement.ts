export interface FundTransaction {
  date: string | null;
  description: string;
  units: number;
  offer_price: number;
  amount: number;
  type: "buy" | "sell" | "dividend" | "other";
}

export interface FundStatementData {
  type: "fund_statement";
  fund_name: string | null;
  fund_type: string | null;
  period_from: string | null;
  period_to: string | null;
  opening_balance: number;
  total_contributions: number;
  gain_loss: number;
  total_withdrawals: number;
  closing_balance: number;
  closing_units: number | null;
  closing_nav: number | null;
  transactions: FundTransaction[];
  parsed_at: string;
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[(),\s]/g, "")) * (raw.includes("(") ? -1 : 1) || 0;
}

function parseMonthDate(raw: string): string | null {
  // "Aug 01, 2025" → "2025-08-01"
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const m = raw.match(/([A-Za-z]{3})\s+(\d{2}),?\s+(\d{4})/);
  if (m) return `${m[3]}-${months[m[1]] ?? "01"}-${m[2]}`;
  return null;
}

function parseStatementDate(raw: string): string | null {
  // "15/04/2026" → "2026-04-15"
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function descToType(desc: string): FundTransaction["type"] {
  const d = desc.toUpperCase();
  if (d.includes("SUBSCRI") || d.includes("PURCHASE")) return "buy";
  if (d.includes("REDEMP") || d.includes("WITHDRAW")) return "sell";
  if (d.includes("DISTRIB") || d.includes("DIVIDEND") || d.includes("REINVEST")) return "dividend";
  return "other";
}

export function parseFundStatement(text: string): FundStatementData {
  // Fund name — typically in a header like "CHAPEL HILL DENHAM PARAMOUNT FUND (EQUITY)"
  const fundMatch = text.match(/([A-Z][A-Z0-9 &()]+FUND[A-Z0-9 &()]*)/i);
  const fundName = fundMatch ? fundMatch[1].trim().replace(/\s+/g, " ") : null;

  // Fund type from parenthetical
  let fundType: string | null = null;
  if (fundName) {
    const typeMatch = fundName.match(/\((EQUITY|FIXED INCOME|BALANCED|MONEY MARKET|ETHICAL|REAL ESTATE)\)/i);
    if (typeMatch) fundType = typeMatch[1].toLowerCase().replace(/ /g, "_");
  }

  // Statement date period
  const periodMatch = text.match(/Statement Date[:\s]+([\d\/]+)\s+to\s+([\d\/]+)/i);
  const periodFrom = periodMatch ? parseStatementDate(periodMatch[1]) : null;
  const periodTo = periodMatch ? parseStatementDate(periodMatch[2]) : null;

  // Account summary
  const openingMatch = text.match(/Opening Balance\s+([\d,]+\.?\d*)/i);
  const contribMatch = text.match(/Total Contributions\s+([\d,]+\.?\d*)/i);
  const gainLossMatch = text.match(/Gain\/Loss\s+\(?([\d,]+\.?\d*)\)?/i);
  const withdrawMatch = text.match(/Total Withdrawals\s+\(?([\d,]+\.?\d*)\)?/i);
  const closingMatch = text.match(/Closing Balance\s+([\d,]+\.?\d*)/i);

  function amtFromMatch(m: RegExpMatchArray | null): number {
    if (!m) return 0;
    return parseFloat(m[1].replace(/,/g, "")) || 0;
  }

  const openingBalance = amtFromMatch(openingMatch);
  const totalContributions = amtFromMatch(contribMatch);
  const gainLoss = gainLossMatch ? (text.includes("Gain/Loss\n" + gainLossMatch[1]) ? amtFromMatch(gainLossMatch) : amtFromMatch(gainLossMatch)) : 0;
  const totalWithdrawals = withdrawMatch ? amtFromMatch(withdrawMatch) : 0;
  const closingBalance = amtFromMatch(closingMatch);

  // Closing line: "Apr 15, 2026 Total/Closing 8,918.00 69.62 620,855.83"
  const closingLineMatch = text.match(/Total\/Closing\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/i);
  const closingUnits = closingLineMatch ? parseFloat(closingLineMatch[1].replace(/,/g, "")) : null;
  const closingNav = closingLineMatch ? parseFloat(closingLineMatch[2].replace(/,/g, "")) : null;

  // Transaction rows: "Mon DD, YYYY   Description   ±Units   Price   ±Amount"
  // e.g. "Aug 01, 2025 Subscription 14,721.00 50.95 749,997.00"
  // or   "Oct 07, 2025 Redemption (6,000.00) 49.77 (298,637.57)"
  const txnPattern = /([A-Za-z]{3}\s+\d{2},\s+\d{4})\s+([\w\s/]+?)\s+([\d,().]+)\s+([\d,.]+)\s+([\d,().]+)/g;
  const transactions: FundTransaction[] = [];

  let txnMatch: RegExpExecArray | null;
  while ((txnMatch = txnPattern.exec(text)) !== null) {
    const [, rawDate, desc, rawUnits, rawPrice, rawAmt] = txnMatch;
    const descClean = desc.trim().replace(/\s+/g, " ");

    // Skip "Total/Closing" line — that's the summary not a transaction
    if (descClean.toUpperCase().includes("TOTAL") || descClean.toUpperCase().includes("CLOSING")) continue;

    const date = parseMonthDate(rawDate);
    const units = parseAmount(rawUnits);
    const price = parseFloat(rawPrice.replace(/,/g, "")) || 0;
    const amount = parseAmount(rawAmt);

    // Skip rows that look like header/junk (price unreasonably small or 0)
    if (price === 0 && units === 0) continue;

    transactions.push({
      date,
      description: descClean,
      units,
      offer_price: price,
      amount,
      type: descToType(descClean),
    });
  }

  return {
    type: "fund_statement",
    fund_name: fundName,
    fund_type: fundType,
    period_from: periodFrom,
    period_to: periodTo,
    opening_balance: openingBalance,
    total_contributions: totalContributions,
    gain_loss: gainLoss,
    total_withdrawals: totalWithdrawals,
    closing_balance: closingBalance,
    closing_units: closingUnits,
    closing_nav: closingNav,
    transactions,
    parsed_at: new Date().toISOString(),
  };
}
