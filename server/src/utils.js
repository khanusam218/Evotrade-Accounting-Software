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

module.exports = { round2, getOrCreateSeries, getOrCreateSeriesByPrefix };
