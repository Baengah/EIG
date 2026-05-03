export interface BankStatementTrade {
  date: string;
  ref: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
  is_trade: boolean;
  trade_type: "buy" | "sell" | null;
  ticker: string | null;
  quantity: number | null;
  price: number | null;
}

export interface BankStatementData {
  type: "bank_statement";
  broker: string | null;
  account_number: string | null;
  account_name: string | null;
  period_from: string | null;
  period_to: string | null;
  opening_balance: number;
  closing_balance: number;
  total_debits: number;
  total_credits: number;
  trades: BankStatementTrade[];
  parsed_at: string;
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[,\s]/g, "")) || 0;
}

function parseDate(raw: string): string | null {
  // DD-Mon-YYYY → YYYY-MM-DD
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const m = raw.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (m) return `${m[3]}-${months[m[2]] ?? "01"}-${m[1]}`;
  return null;
}

// Narration pattern: "BUY TRADE FOR 5,050 UNITS OF GTCO @ NGN 97.90 - CONTRACT AMOUNT"
// or: "SELL TRADE FOR 8,500 UNITS OF UACN @ NGN 96.00 - CONTRACT AMOUNT"
const TRADE_PATTERN = /(BUY|SELL) TRADE FOR ([\d,]+) UNITS? OF ([A-Z0-9]+) @ NGN ([\d,.]+)/i;

export function parseBankStatement(text: string): BankStatementData {
  // Extract header info
  const acctNumMatch = text.match(/Account Number\s+([\d]+)/i);
  const acctNameMatch = text.match(/Account Name\s+([A-Z\s]+?)(?:\n|Account Details)/i);
  const brokerMatch = text.match(/^([A-Z][A-Z\s]+?)\n/m); // First line usually broker name
  const periodMatch = text.match(/Date From\s+(\d{2}\/\d{2}\/\d{4})\s+To\s+(\d{2}\/\d{2}\/\d{4})/i);

  function parseDateDMY(raw: string): string | null {
    const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }

  const periodFrom = periodMatch ? parseDateDMY(periodMatch[1]) : null;
  const periodTo = periodMatch ? parseDateDMY(periodMatch[2]) : null;

  // Summary totals from the last page
  const openingMatch = text.match(/Opening Balance[:\s]+([\d,]+\.?\d*)/i);
  const totalDebitsMatch = text.match(/Total Debits[:\s]+\(?([\d,]+\.?\d*)\)?/i);
  const totalCreditsMatch = text.match(/Total Credits[:\s]+([\d,]+\.?\d*)/i);
  const totalBalanceMatch = text.match(/Total Balance[:\s]+([\d,]+\.?\d*)/i);

  const openingBalance = openingMatch ? parseAmount(openingMatch[1]) : 0;
  const totalDebits = totalDebitsMatch ? parseAmount(totalDebitsMatch[1]) : 0;
  const totalCredits = totalCreditsMatch ? parseAmount(totalCreditsMatch[1]) : 0;
  const closingBalance = totalBalanceMatch ? parseAmount(totalBalanceMatch[1]) : 0;

  // Parse trade rows from the narration text
  // The PDF text for each row roughly combines date, ref, narration, debit, credit, balance
  // We'll scan for lines matching the trade pattern and pull surrounding context

  const trades: BankStatementTrade[] = [];

  // Split text into logical chunks — each trade-related narration block
  // Look for date-prefixed lines: "DD-Mon-YYYY" followed by ref and narration
  const rowPattern = /(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{7,10})\s+([\s\S]+?)([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(?=\d{2}-[A-Za-z]{3}-\d{4}|$)/g;

  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(text)) !== null) {
    const [, rawDate, ref, narration, debit, credit, balance] = match;
    const dateStr = parseDate(rawDate);
    if (!dateStr) continue;

    const narrationClean = narration.replace(/\s+/g, " ").trim();
    const tradeMatch = narrationClean.match(TRADE_PATTERN);

    if (tradeMatch) {
      const [, tradeType, qty, ticker, price] = tradeMatch;
      trades.push({
        date: dateStr,
        ref: ref.trim(),
        narration: narrationClean,
        debit: parseAmount(debit),
        credit: parseAmount(credit),
        balance: parseAmount(balance),
        is_trade: true,
        trade_type: tradeType.toLowerCase() as "buy" | "sell",
        ticker: ticker.toUpperCase(),
        quantity: parseInt(qty.replace(/,/g, ""), 10),
        price: parseAmount(price),
      });
    }
  }

  // Fallback: if the row regex doesn't capture well (PDF text can be messy),
  // scan for trade narrations directly
  if (trades.length === 0) {
    const narrationMatches = Array.from(text.matchAll(new RegExp(TRADE_PATTERN.source, "gi")));
    // Also find dates nearby
    const dateMatches = Array.from(text.matchAll(/(\d{2}-[A-Za-z]{3}-\d{4})/g));
    const amountMatches = Array.from(text.matchAll(/([\d,]+\.\d{2})/g));

    for (const nm of narrationMatches) {
      const pos = nm.index ?? 0;
      // Find the closest date before this match
      let closestDate: string | null = null;
      for (const dm of dateMatches) {
        if ((dm.index ?? 0) <= pos) closestDate = parseDate(dm[1]);
        else break;
      }
      // Find the closest amount after this match (the debit amount)
      let debit = 0;
      for (const am of amountMatches) {
        if ((am.index ?? 0) > pos) { debit = parseAmount(am[1]); break; }
      }

      const [, tradeType, qty, ticker, price] = nm;
      trades.push({
        date: closestDate ?? "",
        ref: "",
        narration: nm[0],
        debit,
        credit: 0,
        balance: 0,
        is_trade: true,
        trade_type: tradeType.toLowerCase() as "buy" | "sell",
        ticker: ticker.toUpperCase(),
        quantity: parseInt(qty.replace(/,/g, ""), 10),
        price: parseAmount(price),
      });
    }
  }

  return {
    type: "bank_statement",
    broker: brokerMatch ? brokerMatch[1].trim() : "CHAPEL HILL DENHAM",
    account_number: acctNumMatch ? acctNumMatch[1].trim() : null,
    account_name: acctNameMatch ? acctNameMatch[1].trim() : null,
    period_from: periodFrom,
    period_to: periodTo,
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    total_debits: totalDebits,
    total_credits: totalCredits,
    trades,
    parsed_at: new Date().toISOString(),
  };
}
