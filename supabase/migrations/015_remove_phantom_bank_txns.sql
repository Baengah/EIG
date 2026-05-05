-- EIG Platform — Remove phantom bank_statement_txns created by migration 014
--
-- Migration 014 incorrectly added one bank_statement_txns entry per CHD contract
-- note (70 rows: 69 buy debits + 1 sell credit). These do not represent real Zenith
-- bank movements. The actual bank picture is:
--   • Periodic lump-sum "Transfer to CHD" debits → already in bank_ledger (migration 006)
--     and synced to bank_statement_txns via migration 013.
--   • UACN sell proceeds credit → already in bank_ledger (migration 006) as
--     'NSE Settlement — UACN sell proceeds...' and synced to bank_statement_txns.
--
-- The transactions table rows from migration 014 are correct and stay.
-- Only the bank_statement_txns entries that were wrongly linked to those transactions
-- are removed here.

DELETE FROM public.bank_statement_txns
WHERE matched_type = 'transaction'
  AND matched_id IN (
    SELECT id FROM public.transactions
    WHERE contract_note_number IN (
      '0005173848','0005174348','0005174367','0005174371','0005174361',
      '0005175751','0005175754','0005175743','0005175747',
      '0005177410','0005177405','0005177416',
      '0005188836','0005188834','0005190551',
      '0005195088','0005195098','0005195634',
      '0005197818','0005198070',
      '0005199055','0005199057','0005199072',
      '0005206404',
      '0005219072','0005219090','0005233102',
      '0005219103','0005233738',
      '0005238664','0005238682','0005239342',
      '0005251864','0005251880','0005251881','0005251884',
      '0005266760','0005266761','0005267078',
      '0005272558',
      '0005296678','0005296715','0005296705','0005296721',
      '0005305313','0005305320','0005305323',
      '0005341131','0005341130','0005341141',
      '0005345048','0005345047','0005345190',
      '0005372596','0005372602','0005372633','0005372655','0005372686','0005372677',
      '0005373014',
      '0005383584','0005383569',
      '0005387361','0005387524',
      '0005389355','0005389348','0005389365',
      '0005410518','0005410534','0005410549'
    )
  );
