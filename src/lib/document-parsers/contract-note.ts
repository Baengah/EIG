export interface ContractNoteData {
  type: "contract_note";
  trade_type: "buy" | "sell";
  trade_date: string | null;
  settlement_date: string | null;
  contract_note_number: string | null;
  security_name: string | null;
  ticker_hint: string | null;
  quantity: number | null;
  price: number | null;
  consideration: number | null;
  broker_commission: number;
  ngx_fees: number;
  cscs_fees: number;
  sec_fees: number;
  stamp_duty: number;
  total_fees: number;
  total_contract_amount: number | null;
  parsed_at: string;
  raw_text_sample: string;
}

function parseNGNAmount(raw: string): number {
  return parseFloat(raw.replace(/[NGN,\s]/g, "")) || 0;
}

function parseDate(raw: string): string | null {
  // Handles DD/MM/YYYY
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

// Company name → ticker hints for common NGX stocks
const COMPANY_TO_TICKER: Record<string, string> = {
  "MTN NIGERIA": "MTNN",
  "GTCO": "GTCO",
  "GUARANTY TRUST": "GTCO",
  "ZENITH BANK": "ZENITHBANK",
  "ACCESS": "ACCESSCORP",
  "PRESCO": "PRESCO",
  "ARADEL": "ARADEL",
  "UAC": "UACN",
  "NGX GROUP": "NGXGROUP",
  "NIGERIAN EXCHANGE": "NGXGROUP",
  "STANBIC": "STANBICIBTC",
  "FBN": "FBNH",
  "FIRST BANK": "FBNH",
  "UBA": "UBA",
  "UNITED BANK": "UBA",
  "DANGCEM": "DANGCEM",
  "DANGOTE CEMENT": "DANGCEM",
  "NESTLE": "NESTLE",
  "SEPLAT": "SEPLAT",
  "TOTAL ENERGIES": "TOTAL",
  "BUACEMENT": "BUACEMENT",
  "TRANSCORP": "TRANSCORP",
  "FIDELITY": "FIDELITYBNK",
};

function guessTickerFromCompany(name: string): string | null {
  const upper = name.toUpperCase();
  for (const [key, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (upper.includes(key)) return ticker;
  }
  return null;
}

export function parseContractNote(text: string, fileName?: string): ContractNoteData {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const tradeType = text.toUpperCase().includes("SELL CONTRACT") ? "sell" : "buy";

  // Trade date
  const tradeDateMatch = text.match(/Trade Date[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  const tradeDate = tradeDateMatch ? parseDate(tradeDateMatch[1]) : null;

  // Settlement date
  const settlementMatch = text.match(/Settlement[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  const settlementDate = settlementMatch ? parseDate(settlementMatch[1]) : null;

  // Contract note number from filename (CONTRACT_NOTE_XXXXXXXXXX.pdf)
  let contractNoteNumber: string | null = null;
  if (fileName) {
    const fnMatch = fileName.match(/(\d{7,12})/);
    if (fnMatch) contractNoteNumber = fnMatch[1];
  }

  // Security name
  let securityName: string | null = null;
  const securityMatch = text.match(/Security\s+([A-Z][A-Z0-9 &().,'-]+(?:PLC|LTD|LIMITED|CORP)?)/i);
  if (securityMatch) {
    securityName = securityMatch[1].trim().replace(/\s+/g, " ");
  }

  const tickerHint = securityName ? guessTickerFromCompany(securityName) : null;

  // Quantity
  let quantity: number | null = null;
  const qtyMatch = text.match(/Quantity\s+([\d,]+)/i);
  if (qtyMatch) quantity = parseInt(qtyMatch[1].replace(/,/g, ""), 10);

  // Price
  let price: number | null = null;
  const priceMatch = text.match(/Price\s+([\d,]+\.?\d*)/i);
  if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ""));

  // Consideration
  let consideration: number | null = null;
  const considerMatch = text.match(/Consideration\s+NGN\s+([\d,]+\.?\d*)/i);
  if (considerMatch) consideration = parseNGNAmount(considerMatch[1]);

  // Fees — look for VAT INCL amounts (last column in the fee table)
  // Pattern: "Fee Name   rate%   VAT_amount   VATINCL_amount"
  // or just grab Total Commission & Fees
  let brokerCommission = 0;
  let ngxFees = 0;
  let cscsFees = 0;
  let secFees = 0;
  let stampDuty = 0;

  const brokerMatch = text.match(/Broker Commission[\s\d.%]+?([\d,]+\.?\d*)\s*$/m);
  if (brokerMatch) brokerCommission = parseNGNAmount(brokerMatch[1]);

  const ngxMatch = text.match(/NGX Fees[\s\d.%]+?([\d,]+\.?\d*)\s*$/m);
  if (ngxMatch) ngxFees = parseNGNAmount(ngxMatch[1]);

  // CSCS X-Alert Fees
  const cscsXMatch = text.match(/CSCS X-Alert[\s\S]*?([\d,]+\.?\d*)\s*$/m);
  if (cscsXMatch) cscsFees = parseNGNAmount(cscsXMatch[1]);

  const secMatch = text.match(/SEC Fees[\s\d.%]+?([\d,]+\.?\d*)\s*$/m);
  if (secMatch) secFees = parseNGNAmount(secMatch[1]);

  const stampMatch = text.match(/Stamp Duty[\s\d.%]+?([\d,]+\.?\d*)\s*$/m);
  if (stampMatch) stampDuty = parseNGNAmount(stampMatch[1]);

  // Total Commission & Fees
  let totalFees = 0;
  const totalFeesMatch = text.match(/Total Commission\s*&\s*Fees\s+NGN\s+([\d,]+\.?\d*)/i);
  if (totalFeesMatch) {
    totalFees = parseNGNAmount(totalFeesMatch[1]);
  } else {
    totalFees = brokerCommission + ngxFees + cscsFees + secFees + stampDuty;
  }

  // Total contract amount
  let totalContractAmount: number | null = null;
  const totalMatch = text.match(/TOTAL CONTRACT AMOUNT\s+NGN\s+([\d,]+\.?\d*)/i);
  if (totalMatch) totalContractAmount = parseNGNAmount(totalMatch[1]);

  return {
    type: "contract_note",
    trade_type: tradeType,
    trade_date: tradeDate,
    settlement_date: settlementDate,
    contract_note_number: contractNoteNumber,
    security_name: securityName,
    ticker_hint: tickerHint,
    quantity,
    price,
    consideration,
    broker_commission: brokerCommission,
    ngx_fees: ngxFees,
    cscs_fees: cscsFees,
    sec_fees: secFees,
    stamp_duty: stampDuty,
    total_fees: totalFees,
    total_contract_amount: totalContractAmount,
    parsed_at: new Date().toISOString(),
    raw_text_sample: text.slice(0, 500),
  };
}
