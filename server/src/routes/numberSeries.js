const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { getOrCreateSeries } = require('../utils');

// Every document type a fresh company might want to pre-assign a series for
// (e.g. Sales Person / POS Counter setup screens), even before the first
// document of that type has actually been created and self-healed one.
const STANDARD_SERIES = [
  ['Customers', 'C-'], ['Vendors', 'V-'], ['Products', 'P-'],
  ['Sales Quotations', 'SQ-'], ['Sales Orders', 'SO-'], ['Sales Invoices', 'SI-'],
  ['Receive Payments', 'RM-'], ['Sales Returns', 'SR-'], ['Sales Refunds', 'CR-'],
  ['Sales Settlements', 'CS-'], ['Recurring Invoices', 'RI-'],
  ['Purchase Quotations', 'RFQ-'], ['Purchase Orders', 'PO-'], ['Purchase Invoices', 'PI-'],
  ['Make Payments', 'MP-'], ['Purchase Returns', 'PR-'], ['Purchase Refunds', 'VR-'],
  ['Purchase Settlements', 'PS-'],
  ['Journal Entries', 'JE-'], ['Expenses', 'E-'], ['Fund Transfers', 'FT-'],
  ['Other Collections', 'OC-'], ['Other Payments', 'OP-'], ['Bank Deposits', 'BD-'],
  ['Credit Notes', 'CN-'], ['Debit Notes', 'DN-'], ['Other Contact Settlements', 'OCS-'],
];

router.get('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [name, prefix] of STANDARD_SERIES) {
      await getOrCreateSeries(client, name, prefix, 6);
    }
    const { rows } = await client.query('SELECT id, name, prefix, padding, next_number FROM number_series ORDER BY name');
    await client.query('COMMIT');
    res.json(rows);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
