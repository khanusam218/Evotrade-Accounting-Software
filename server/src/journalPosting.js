// Shared helper so every document type (Sales/Purchase Invoices, Payments,
// Returns, Refunds, Settlements, Credit/Debit Notes, Bank Deposits, Fund
// Transfers, Expenses) posts a real, balanced Journal Entry alongside its
// direct Chart of Accounts balance update, instead of only moving balances.
// This is what makes Trial Balance / P&L / Balance Sheet / Account Ledger /
// Audit Log actually reflect the transaction, not just manually-created JEs.
const { round2 } = require('./utils');

async function nextJENumber(client) {
  const { rows } = await client.query(
    `SELECT prefix, next_number, padding FROM number_series WHERE name = 'Journal Entries' FOR UPDATE`
  );
  let row = rows[0];
  if (!row) {
    const { rows: created } = await client.query(
      `INSERT INTO number_series (name, prefix, next_number, padding)
       VALUES ('Journal Entries', 'JE-', 1, 6) RETURNING prefix, next_number, padding`
    );
    row = created[0];
  }
  // Self-heal against manually-created JEs (or any other drift) the same way
  // every other document type's numbering already does: never hand out a
  // number that's <= the highest one actually in use, even if the counter
  // itself is stale.
  const { rows: [{ max_used }] } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_used
       FROM journal_entries WHERE number ~ '^[A-Z]+-[0-9]+$'`
  );
  const next = Math.max(Number(row.next_number), Number(max_used) + 1);
  await client.query(`UPDATE number_series SET next_number = $1 WHERE name = 'Journal Entries'`, [next + 1]);
  return `${row.prefix}${String(next).padStart(row.padding, '0')}`;
}

// lines: [{ account_id, debit?, credit?, description? }] — lines with a zero
// (or missing) amount, or no account_id, are dropped automatically so callers
// don't need to special-case zero-amount components (e.g. no tax on a sale).
async function postJournalEntry(client, { date, memo, reference = null, source_type, source_id, lines }) {
  const cleanLines = (lines || []).filter(
    (l) => l.account_id && (round2(l.debit || 0) > 0 || round2(l.credit || 0) > 0)
  );
  if (!cleanLines.length) return null;

  const totalDebit  = round2(cleanLines.reduce((s, l) => s + round2(l.debit || 0), 0));
  const totalCredit = round2(cleanLines.reduce((s, l) => s + round2(l.credit || 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Journal entry out of balance for ${source_type || 'posting'} #${source_id ?? ''}: ` +
      `debit ${totalDebit} vs credit ${totalCredit}`
    );
  }

  const number = await nextJENumber(client);
  const { rows } = await client.query(
    `INSERT INTO journal_entries (number, date, memo, reference, status, total_debit, total_credit, source_type, source_id)
     VALUES ($1,$2,$3,$4,'posted',$5,$6,$7,$8) RETURNING *`,
    [number, date, memo || null, reference, totalDebit, totalCredit, source_type || null, source_id || null]
  );
  const je = rows[0];
  for (const l of cleanLines) {
    await client.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
       VALUES ($1,$2,$3,$4,$5)`,
      [je.id, l.account_id, l.description || null, round2(l.debit || 0), round2(l.credit || 0)]
    );
  }
  return je;
}

// Reverses every posted JE for a given source document by posting a new JE
// with debits/credits swapped (never edits/deletes the original — that's the
// audit-safe way to undo a posting once other entries may already reference
// the account balances it produced).
async function reverseJournalEntriesForSource(client, { source_type, source_id, date, memo }) {
  const { rows: originals } = await client.query(
    `SELECT * FROM journal_entries WHERE source_type=$1 AND source_id=$2 AND status='posted'`,
    [source_type, source_id]
  );
  const reversals = [];
  for (const orig of originals) {
    const { rows: lines } = await client.query(
      `SELECT * FROM journal_entry_lines WHERE journal_entry_id=$1`, [orig.id]
    );
    const swapped = lines.map((l) => ({
      account_id: l.account_id,
      description: l.description,
      debit: Number(l.credit),
      credit: Number(l.debit),
    }));
    const reversal = await postJournalEntry(client, {
      date, memo: memo || `Reversal of ${orig.number}`, reference: orig.number,
      source_type, source_id, lines: swapped,
    });
    if (reversal) reversals.push(reversal);
  }
  return reversals;
}

// Every existing route computes a signed `change` to apply to
// `chart_of_accounts.current_balance` (positive = increase, negative =
// decrease), using each account's own normal_balance to decide the sign.
// This turns that same signed change into the debit/credit line a real JE
// needs, so the JE always mirrors exactly what the direct balance update
// already does — same accounts, same amounts, never a second source of truth.
function changeToLine(account, change, description) {
  const amt = round2(Math.abs(change));
  if (amt === 0) return { account_id: account.id, debit: 0, credit: 0, description };
  const isIncrease = change > 0;
  const isDebitNormal = account.normal_balance === 'debit';
  const isDebit = isIncrease === isDebitNormal;
  return {
    account_id: account.id,
    debit: isDebit ? amt : 0,
    credit: isDebit ? 0 : amt,
    description,
  };
}

module.exports = { postJournalEntry, reverseJournalEntriesForSource, changeToLine };
