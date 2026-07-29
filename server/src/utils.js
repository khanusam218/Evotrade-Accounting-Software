// Utility functions for the API

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Fetch a company's number_series row for `name`, creating one on the fly
// (using defaultPrefix/defaultPadding) the first time a company needs it.
// Every company gets its own row (RLS-scoped) — there is no cross-company
// template to copy from, so new companies fall back to these hardcoded
// defaults, which match what the very first ("evotrade") company was
// originally seeded with.
async function getOrCreateSeries(client, name, defaultPrefix, defaultPadding = 6) {
  const { rows } = await client.query(
    `SELECT prefix, next_number, padding FROM number_series WHERE name = $1 FOR UPDATE`,
    [name]
  );
  if (rows.length) return rows[0];
  const { rows: created } = await client.query(
    `INSERT INTO number_series (name, prefix, next_number, padding)
     VALUES ($1, $2, 1, $3)
     RETURNING prefix, next_number, padding`,
    [name, defaultPrefix, defaultPadding]
  );
  return created[0];
}

// Same as getOrCreateSeries, but for the (larger) set of routes that look
// the series row up by `prefix` instead of `name` (many of these were
// originally seeded with name=NULL, prefix-only).
async function getOrCreateSeriesByPrefix(client, prefix, defaultPadding = 6) {
  const { rows } = await client.query(
    `SELECT prefix, next_number, padding FROM number_series WHERE prefix = $1 FOR UPDATE`,
    [prefix]
  );
  if (rows.length) return rows[0];
  const { rows: created } = await client.query(
    `INSERT INTO number_series (prefix, next_number, padding)
     VALUES ($1, 1, $2)
     RETURNING prefix, next_number, padding`,
    [prefix, defaultPadding]
  );
  return created[0];
}

// Formats and consumes the next number for a series, but first checks the
// actual documents already in `table` — not just the series counter — and
// takes whichever is higher. Without this, a company whose documents were
// migrated/imported (so number_series never tracked them) gets a fresh
// counter starting at 1, colliding with pre-existing document numbers the
// very first time it creates something new. `table`/`column` are always
// hardcoded literals passed by route code, never request input, so string
// interpolation here is safe (no parameterized-identifier support in pg).
async function safeNextNumber(client, series, updateWhereCol, updateWhereVal, table, column) {
  const { rows: maxRows } = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(${column}, '[^0-9]', '', 'g') AS INTEGER)), 0) AS max_num
     FROM ${table} WHERE ${column} ~ ('^' || $1 || '[0-9]+$')`,
    [series.prefix]
  );
  const useNum = Math.max(Number(series.next_number), Number(maxRows[0].max_num) + 1);
  await client.query(
    `UPDATE number_series SET next_number = $1 WHERE ${updateWhereCol} = $2`,
    [useNum + 1, updateWhereVal]
  );
  return `${series.prefix}${String(useNum).padStart(Number(series.padding), '0')}`;
}

module.exports = { round2, getOrCreateSeries, getOrCreateSeriesByPrefix, safeNextNumber };
