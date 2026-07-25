import { useEffect, useRef, useState } from 'react';
import { getSalesInvoice, cancelSalesInvoice, approveSalesInvoice } from '../api/salesInvoices';
import type { SalesInvoice, SalesInvoiceLine } from '../types/salesInvoice';
import { SI_STATUS_COLORS, SI_STATUS_LABELS } from '../types/salesInvoice';
import { getCompanySettings } from '../api/companySettings';

interface Props {
  invoice: SalesInvoice;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}

const fmt = (n: number | string) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SalesInvoiceDetailView({ invoice, onClose, onEdit, onRefresh }: Props) {
  const [full,        setFull]        = useState<SalesInvoice | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [actioning,   setActioning]   = useState(false);
  const [comment,     setComment]     = useState('');
  const [activityLog, setActivityLog] = useState<{ text: string; date: string }[]>([]);
  const [showPrintDd, setShowPrintDd] = useState(false);
  const printDdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getSalesInvoice(invoice.id)
      .then(setFull)
      .finally(() => setLoading(false));
  }, [invoice.id]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (printDdRef.current && !printDdRef.current.contains(e.target as Node)) setShowPrintDd(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const data = full ?? invoice;
  const lines: SalesInvoiceLine[] = full?.lines ?? [];
  const totalQty = lines.reduce((s, l) => s + Number(l.quantity), 0);
  const uniqueProducts = new Set(lines.map(l => l.product_id).filter(Boolean)).size;

  const customerAddress = [
    data.customer_address_line_1,
    data.customer_address_line_2,
    data.customer_city,
    data.customer_state_province,
    data.customer_country,
  ].filter(Boolean).join(', ') || data.shipping_address || '—';

  async function handleVoid() {
    if (!window.confirm(`Void invoice ${data.number}?`)) return;
    setActioning(true);
    try { await cancelSalesInvoice(data.id); onRefresh(); onClose(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setActioning(false); }
  }

  async function handleApprove() {
    if (!window.confirm(`Approve invoice ${data.number}?`)) return;
    setActioning(true);
    try { await approveSalesInvoice(data.id); onRefresh(); getSalesInvoice(invoice.id).then(setFull); }
    catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setActioning(false); }
  }

  function getActiveTemplate(): string {
    try {
      const saved = localStorage.getItem('evotrade_printing_templates_v2');
      if (saved) {
        const t = JSON.parse(saved);
        const active = (t['Sale Invoice'] ?? []).find((x: {active: boolean; id: string}) => x.active);
        if (active) return active.id;
      }
    } catch {}
    return 'si-default';
  }

  async function handlePrint() {
    const tpl = getActiveTemplate();
    const customerAddr = customerAddress !== '—' ? customerAddress : (data.shipping_address ?? '');

    let cs: Record<string, string> = {};
    try { cs = await getCompanySettings(); } catch { /* use defaults */ }

    let activeBiz: { name?: string; initials?: string; color?: string } = {};
    try { activeBiz = JSON.parse(localStorage.getItem('evotrade_active_business') || '{}'); } catch { /* */ }

    let coLogo: string | null = null;
    let coSignature: string | null = null;
    try {
      const imgs = JSON.parse(localStorage.getItem('evotrade_company_images') || '{}');
      coLogo = imgs.profile || null;
      coSignature = imgs.signature || null;
    } catch { /* */ }

    const coName = cs.company_name || activeBiz.name || 'My Business';
    const coInitials = activeBiz.initials || coName.slice(0, 2).toUpperCase();
    const coColor = activeBiz.color || '#1e40af';
    const coPhone = cs.phone || '';
    const coNtn = cs.ntn || '';
    const coEmail = cs.email || '';
    const coFax = cs.fax || '';
    // Logo already conveys the company identity → don't also print the name as text
    const showName = !coLogo;
    const coLocation = [cs.city, cs.state, cs.zip, cs.country].filter(Boolean).join(', ');
    const metaLineDefs = [
      cs.address || '',
      coLocation,
      [coPhone && `Ph: ${coPhone}`, coEmail && coEmail, coFax && `Fax: ${coFax}`].filter(Boolean).join('  •  '),
      coNtn && `NTN: ${coNtn}`,
    ].filter(Boolean);
    const metaHtml = (color: string, size = 10) =>
      metaLineDefs.map(l => `<div style="font-size:${size}px;color:${color};margin-top:1px">${l}</div>`).join('');

    const logoHtmlLarge = coLogo
      ? `<img src="${coLogo}" style="max-width:100px;max-height:64px;object-fit:contain;border-radius:6px;background:#fff;padding:2px;border:1px solid #e5e7eb" />`
      : `<div style="width:64px;height:64px;border-radius:8px;background:${coColor};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff">${coInitials}</div>`;

    const signatureHtml = coSignature
      ? `<img src="${coSignature}" style="display:block;max-height:56px;max-width:180px;object-fit:contain" />`
      : `<div style="width:140px;border-top:1px solid #9ca3af;padding-top:4px;font-size:9px;color:#9ca3af">Authorized Signature</div>`;

    // ── Reusable template engine for the configurable invoice designs ──
    type StdCfg = {
      accent: string; pageBg?: string; serif?: boolean; frame?: boolean;
      header: 'split' | 'bar' | 'centered'; headerBg?: string; headerColor?: string;
      title: 'plain' | 'big' | 'star' | 'thin' | 'none' | 'total';
      tableHeadBg: string; tableHeadColor: string;
      footer: 'banner' | 'bar' | 'wave' | 'plain';
      logoBottom?: boolean;
    };
    const printScript = '<script>window.onload=function(){window.focus();window.print();}<\/script>';
    const dateStr = data.date.slice(0, 10);
    const dueStr = data.due_date?.slice(0, 10) ?? '—';
    const balanceDue = Number(data.net_amount) - Number(data.paid_amount);

    const stdRows = (accent: string) => lines.map((l, i) => `
      <tr>
        <td class="c-num">${i + 1}</td>
        <td class="c-prod">${l.product_name ?? l.description ?? '—'}${l.description && l.product_name ? `<br><span class="c-desc">${l.description}</span>` : ''}</td>
        <td class="r">${Number(l.quantity).toFixed(2)}</td>
        <td class="r">${fmt(l.unit_price)}</td>
        <td class="r">${Number(l.discount_pct).toFixed(2)}%</td>
        <td class="r" style="font-weight:700;color:${accent}">${fmt(l.amount)}</td>
      </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:24px;font-style:italic">No line items</td></tr>`;

    function buildStandard(cfg: StdCfg) {
      const { accent, pageBg = '#fff', serif = false, frame = false, header, headerBg, headerColor = '#fff', title, tableHeadBg, tableHeadColor, footer, logoBottom = true } = cfg;
      const fontFamily = serif ? `'Georgia','Times New Roman',serif` : `'Helvetica Neue',Arial,sans-serif`;
      const meta = '#6b7280';
      const coContactInline = [coPhone && `Ph: ${coPhone}`, coEmail && coEmail].filter(Boolean).join(' • ');

      const titleHtml = (color: string) => {
        if (title === 'none') return '';
        if (title === 'total') return `<div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px;padding:10px 16px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af">Invoice Total</div><div style="font-size:24px;font-weight:800;color:${color}">${fmt(data.net_amount)}</div></div>`;
        if (title === 'star') return `<div style="font-size:26px;font-weight:900;letter-spacing:4px;color:${color}">★ INVOICE ★</div>`;
        if (title === 'thin') return `<div style="font-size:30px;font-weight:200;letter-spacing:6px;color:${color}">invoice</div>`;
        if (title === 'big') return `<div style="font-size:34px;font-weight:800;letter-spacing:3px;color:${color};text-transform:uppercase">Invoice</div>`;
        return `<div style="font-size:22px;font-weight:800;letter-spacing:4px;color:${color};text-transform:uppercase">Invoice</div>`;
      };

      let headerHtml = '';
      if (header === 'bar') {
        headerHtml = `
          <div style="background:${headerBg || accent};color:${headerColor};padding:18px 40px;display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:14px">
              ${(coLogo && !logoBottom) ? `<img src="${coLogo}" style="max-width:90px;max-height:50px;object-fit:contain;background:#fff;border-radius:4px;padding:3px" />` : ''}
              ${(showName || logoBottom) ? `<div style="font-size:22px;font-weight:800">${coName}</div>` : ''}
            </div>
            <div style="font-size:24px;font-weight:800;letter-spacing:4px">INVOICE</div>
          </div>`;
      } else if (header === 'centered') {
        headerHtml = `
          <div style="text-align:center;padding:26px 40px 16px">
            ${(coLogo && !logoBottom) ? `<div style="margin-bottom:8px"><img src="${coLogo}" style="max-width:120px;max-height:70px;object-fit:contain;display:inline-block" /></div>` : ''}
            ${titleHtml(accent)}
            ${showName ? `<div style="font-size:18px;font-weight:800;color:${accent};margin-top:6px;text-transform:uppercase">${coName}</div>` : ''}
          </div>`;
      } else {
        headerHtml = `
          <div style="padding:30px 40px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${accent}">
            <div style="display:flex;align-items:center;gap:16px">
              ${(coLogo && !logoBottom) ? `<img src="${coLogo}" style="max-width:110px;max-height:70px;object-fit:contain" />` : (!coLogo ? `<div style="width:64px;height:64px;border-radius:8px;background:${accent};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff">${coInitials}</div>` : '')}
              ${(showName || logoBottom) ? `<div style="font-size:24px;font-weight:800;color:${accent}">${coName}</div>` : ''}
            </div>
            <div style="text-align:right">
              ${titleHtml(accent)}
              <div style="font-size:13px;font-weight:700;color:#374151;margin-top:4px">${data.number}</div>
            </div>
          </div>`;
      }

      const infoBand = `
        <div style="padding:18px 40px;background:#f8fafc;border-bottom:1px solid #e5e7eb">
          <div style="display:flex;justify-content:space-between;gap:24px">
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;min-width:230px;max-width:46%">
              <div class="lbl">Bill From</div>
              <div class="val">${coName}</div>
              ${cs.address ? `<div style="font-size:10px;color:${meta};margin-top:3px;line-height:1.5">${cs.address}</div>` : ''}
              ${coLocation ? `<div style="font-size:10px;color:${meta};line-height:1.5">${coLocation}</div>` : ''}
              ${coContactInline ? `<div style="font-size:10px;color:${meta};line-height:1.5">${coContactInline}</div>` : ''}
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;min-width:230px;max-width:46%;text-align:right">
              <div class="lbl">Bill To</div>
              <div class="val">${data.customer_name}</div>
              ${customerAddr ? `<div style="font-size:10px;color:${meta};margin-top:3px;line-height:1.5">${customerAddr}</div>` : ''}
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px 40px;margin-top:14px">
            <div><div class="lbl">Invoice Date</div><div class="val">${dateStr}</div></div>
            <div><div class="lbl">Due Date</div><div class="val">${dueStr}</div></div>
            <div><div class="lbl">Invoice No.</div><div class="val">${data.number}</div></div>
            ${data.reference ? `<div><div class="lbl">Reference</div><div class="val">${data.reference}</div></div>` : ''}
          </div>
        </div>`;

      const table = `
        <div style="padding:22px 40px 0">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:${tableHeadBg}">
              <th style="color:${tableHeadColor}">#</th>
              <th style="color:${tableHeadColor}">Product / Description</th>
              <th style="color:${tableHeadColor};text-align:right">Qty</th>
              <th style="color:${tableHeadColor};text-align:right">Unit Price</th>
              <th style="color:${tableHeadColor};text-align:right">Disc.</th>
              <th style="color:${tableHeadColor};text-align:right">Amount (PKR)</th>
            </tr></thead>
            <tbody>${stdRows(accent)}</tbody>
          </table>
        </div>`;

      const bottom = `
        <div style="padding:20px 40px 10px;display:flex;justify-content:space-between;align-items:flex-start">
          <div style="max-width:300px">
            <div class="lbl">Notes &amp; Terms</div>
            <div style="font-size:10px;color:#6b7280;border-left:3px solid ${accent};padding-left:10px;line-height:1.6;margin-top:6px">${data.notes || 'Thank you for your business. Payment is due by the due date shown above.'}</div>
            <div style="margin-top:22px">${signatureHtml}</div>
            ${(logoBottom && coLogo) ? `<div style="margin-top:16px"><img src="${coLogo}" style="max-width:130px;max-height:75px;object-fit:contain" /></div>` : ''}
          </div>
          <div style="width:270px">
            <div class="t-row"><span>Subtotal</span><span>${fmt(data.gross_amount)}</span></div>
            <div class="t-row"><span>Discount</span><span>− ${fmt(data.discount)}</span></div>
            <div class="t-row"><span>Tax</span><span>${fmt(data.tax_amount)}</span></div>
            <div style="background:${accent};color:#fff;padding:11px 14px;border-radius:6px;margin-top:8px;display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span>Net Amount (PKR)</span><span>${fmt(data.net_amount)}</span></div>
            <div class="t-row" style="margin-top:4px"><span>Amount Received</span><span>${fmt(data.paid_amount)}</span></div>
            ${balanceDue > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-weight:700;color:#dc2626"><span>Balance Due</span><span>${fmt(balanceDue)}</span></div>` : ''}
          </div>
        </div>`;

      let footerHtml = '';
      if (footer === 'banner') {
        footerHtml = `<div style="background:${accent};color:#fff;text-align:center;padding:13px;font-size:11px;font-weight:700;letter-spacing:3px;margin-top:6px">THANK YOU FOR YOUR BUSINESS</div>`;
      } else if (footer === 'bar') {
        footerHtml = `<div style="margin:14px 40px 0;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9.5px;color:#9ca3af"><span>Printed: ${new Date().toLocaleDateString()} | ${data.number}</span>${showName ? `<span style="color:${accent};font-weight:700">${coName}</span>` : ''}</div><div style="background:${accent};height:10px;margin-top:10px"></div>`;
      } else if (footer === 'wave') {
        footerHtml = `<div style="position:relative;height:90px;margin-top:14px"><svg viewBox="0 0 800 90" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="M0,40 C200,5 400,70 600,35 C700,18 760,55 800,38 L800,90 L0,90 Z" fill="${accent}" opacity="0.7"/><path d="M0,60 C220,30 420,80 620,55 C720,42 770,65 800,58 L800,90 L0,90 Z" fill="${accent}"/></svg><div style="position:absolute;bottom:10px;left:0;right:0;text-align:center;color:#fff;font-size:11px;font-weight:700;letter-spacing:2px">THANK YOU FOR YOUR BUSINESS</div></div>`;
      } else {
        footerHtml = `<div style="margin:14px 40px 0;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;font-size:9.5px;color:#9ca3af">Printed: ${new Date().toLocaleDateString()} | ${data.number}</div>`;
      }

      const frameOpen = frame ? `<div style="margin:14px;border:3px double ${accent};padding:8px">` : '';
      const frameClose = frame ? `</div>` : '';

      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${data.number}</title>
        <style>
          @page{margin:0;size:A4}
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:${fontFamily};color:#1f2937;background:${pageBg};font-size:11px}
          th{padding:10px 12px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;text-align:left}
          td{padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#374151;vertical-align:top}
          td.c-num{color:#9ca3af;width:28px}
          td.c-prod{font-weight:600;color:#1f2937}
          td.r{text-align:right;font-family:'Courier New',monospace}
          .c-desc{font-size:9.5px;color:#9ca3af;font-weight:400}
          tbody tr:nth-child(even){background:#f8fafc}
          .lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:2px}
          .val{font-size:12px;font-weight:700;color:#1f2937}
          .t-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:11px}
          @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
        </style></head><body>
        ${frameOpen}${headerHtml}${infoBand}${table}${bottom}${footerHtml}${frameClose}
        ${printScript}
        </body></html>`;
    }

    function buildSidebar() {
      const rows = lines.map(l => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0">${l.product_name ?? l.description ?? '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right">${Number(l.quantity).toFixed(2)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right">${fmt(l.unit_price)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#e11d48">${fmt(l.amount)}</td>
        </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:24px;color:#9ca3af">No line items</td></tr>`;
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${data.number}</title>
        <style>@page{margin:0;size:A4}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#374151}.lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style>
        </head><body>
        <div style="display:flex;min-height:100vh">
          <div style="width:46px;background:#1f2937;color:#fff;display:flex;align-items:center;justify-content:center">
            <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:13px;font-weight:700;letter-spacing:3px;white-space:nowrap">INVOICE ${data.number}</div>
          </div>
          <div style="flex:1;padding:30px 36px">
            <div style="margin-bottom:18px">
              <div style="font-size:24px;font-weight:800;color:#1f2937">${coName}</div>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 16px;margin-bottom:10px">
              <div style="flex:1">
                <div class="lbl">Bill From</div>
                <div style="font-weight:700">${coName}</div>
                ${cs.address ? `<div style="color:#6b7280;font-size:10px">${cs.address}</div>` : ''}
                ${coLocation ? `<div style="color:#6b7280;font-size:10px">${coLocation}</div>` : ''}
                ${[coPhone && `Ph: ${coPhone}`, coEmail && coEmail].filter(Boolean).join(' • ') ? `<div style="color:#6b7280;font-size:10px">${[coPhone && `Ph: ${coPhone}`, coEmail && coEmail].filter(Boolean).join(' • ')}</div>` : ''}
              </div>
              <div style="flex:1;text-align:right">
                <div class="lbl">Bill To</div>
                <div style="font-weight:700">${data.customer_name}</div>
                ${customerAddr ? `<div style="color:#6b7280;font-size:10px">${customerAddr}</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:24px;margin-bottom:18px;font-size:10px">
              <div><span style="color:#6b7280">Invoice Date: </span><b style="color:#1f2937">${dateStr}</b></div>
              <div><span style="color:#e11d48;font-weight:700">Due Date: </span><b>${dueStr}</b></div>
              ${data.reference ? `<div><span style="color:#6b7280">Ref: </span><b>${data.reference}</b></div>` : ''}
            </div>
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:#fb7185;color:#fff"><th style="padding:9px 10px;text-align:left;font-size:9.5px;text-transform:uppercase">Description</th><th style="padding:9px 10px;text-align:right;font-size:9.5px;text-transform:uppercase">Qty</th><th style="padding:9px 10px;text-align:right;font-size:9.5px;text-transform:uppercase">Unit Price</th><th style="padding:9px 10px;text-align:right;font-size:9.5px;text-transform:uppercase">Amount</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div style="display:flex;justify-content:space-between;margin-top:20px">
              <div style="margin-top:30px">${signatureHtml}${coLogo ? `<div style="margin-top:16px"><img src="${coLogo}" style="max-width:120px;max-height:70px;object-fit:contain" /></div>` : ''}</div>
              <div style="width:250px">
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6"><span>Subtotal</span><span>${fmt(data.gross_amount)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6"><span>Discount</span><span>− ${fmt(data.discount)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6"><span>Tax</span><span>${fmt(data.tax_amount)}</span></div>
                <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:800;color:#e11d48;font-size:15px;border-top:2px solid #e5e7eb"><span>Total (PKR)</span><span>${fmt(data.net_amount)}</span></div>
              </div>
            </div>
          </div>
        </div>
        ${printScript}
        </body></html>`;
    }

    const stdConfigs: Record<string, StdCfg> = {
      'si-default':  { accent: '#1e40af', header: 'split',    title: 'big',   tableHeadBg: '#1e40af', tableHeadColor: '#fff', footer: 'banner' },
      'si-classic':  { accent: '#111827', header: 'split',    title: 'plain', tableHeadBg: '#111827', tableHeadColor: '#fff', footer: 'plain' },
      'si-total':    { accent: '#2563eb', header: 'split',    title: 'total', tableHeadBg: '#eff6ff', tableHeadColor: '#1e3a8a', footer: 'plain' },
      'si-boldstar': { accent: '#dc2626', header: 'centered', title: 'star',  tableHeadBg: '#dc2626', tableHeadColor: '#fff', footer: 'banner', pageBg: '#fafafa' },
      'si-wave':     { accent: '#2563eb', header: 'split',    title: 'big',   tableHeadBg: '#dbeafe', tableHeadColor: '#1e3a8a', footer: 'wave' },
      'si-vintage':  { accent: '#78350f', header: 'centered', title: 'plain', tableHeadBg: '#78350f', tableHeadColor: '#fff', footer: 'plain', pageBg: '#f5ecd9', serif: true, frame: true, logoBottom: true },
      'si-bluebar':  { accent: '#2563eb', header: 'bar',      title: 'none',  tableHeadBg: '#2563eb', tableHeadColor: '#fff', footer: 'bar' },
      'si-minimal':  { accent: '#111827', header: 'split',    title: 'thin',  tableHeadBg: '#f3f4f6', tableHeadColor: '#374151', footer: 'plain' },
    };

    let html = '';

    if (tpl === 'si-model') {
      // ── Model # & Brand template ─────────────────────────────────
      const rows = lines.map(l => `
        <tr>
          <td>${l.product_name ?? '—'}</td>
          <td style="color:#555">${l.description ?? '—'}</td>
          <td style="text-align:right">${Number(l.quantity).toFixed(2)}</td>
          <td style="text-align:right">${Number(l.unit_price).toFixed(2)}</td>
          <td style="text-align:right">${Number(l.discount_pct).toFixed(2)}%</td>
          <td style="text-align:right;font-weight:600">${fmt(l.amount)}</td>
        </tr>`).join('');
      html = `<!DOCTYPE html><html><head><title>${data.number}</title>
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:Arial,sans-serif;font-size:11px;color:#222;background:#fff}
          .header{background:#1e293b;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
          .header .company{font-size:15px;font-weight:700}
          .header .logo{display:flex;align-items:center;justify-content:center}
          .title-bar{background:${coColor};color:#fff;text-align:center;padding:6px;font-weight:700;font-size:13px;letter-spacing:2px}
          .info{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #e5e7eb;border-top:none}
          .info-cell{padding:6px 12px;border-bottom:1px solid #f3f4f6}
          .info-cell label{color:#6b7280;font-size:10px;display:block;margin-bottom:1px}
          .info-cell span{font-weight:600}
          table{width:100%;border-collapse:collapse;margin-top:16px}
          thead{background:#1e293b;color:#fff}
          th{padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
          th.r,td.r{text-align:right}
          td{padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:11px}
          tr:nth-child(even) td{background:#f9fafb}
          .summary-wrap{display:flex;justify-content:flex-end;margin-top:20px}
          .summary{min-width:260px;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden}
          .summary-row{display:flex;justify-content:space-between;padding:5px 14px;font-size:11px}
          .summary-row.total{background:#1e293b;color:#fff;font-weight:700;font-size:13px}
          .footer{background:${coColor};color:#fff;text-align:center;padding:8px;margin-top:24px;font-size:11px}
        </style></head><body>
        <div class="header">
          <div class="company">${coName}</div>
          <div style="font-size:18px;font-weight:800;letter-spacing:3px">INVOICE</div>
        </div>
        <div class="title-bar">SALE INVOICE</div>
        <div style="display:flex;justify-content:space-between;gap:16px;padding:12px;border:1px solid #e5e7eb;border-top:none">
          <div style="flex:1">
            <div style="color:#6b7280;font-size:9px;text-transform:uppercase;font-weight:700;letter-spacing:1px">Bill From</div>
            <div style="font-weight:700;font-size:12px">${coName}</div>
            ${cs.address ? `<div style="color:#6b7280;font-size:10px">${cs.address}</div>` : ''}
            ${coLocation ? `<div style="color:#6b7280;font-size:10px">${coLocation}</div>` : ''}
            ${[coPhone && `Ph: ${coPhone}`, coEmail && coEmail].filter(Boolean).join(' • ') ? `<div style="color:#6b7280;font-size:10px">${[coPhone && `Ph: ${coPhone}`, coEmail && coEmail].filter(Boolean).join(' • ')}</div>` : ''}
          </div>
          <div style="flex:1;text-align:right">
            <div style="color:#6b7280;font-size:9px;text-transform:uppercase;font-weight:700;letter-spacing:1px">Bill To</div>
            <div style="font-weight:700;font-size:12px">${data.customer_name}</div>
            ${customerAddr ? `<div style="color:#6b7280;font-size:10px">${customerAddr}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:24px;padding:8px 12px;border:1px solid #e5e7eb;border-top:none;background:#f9fafb;font-size:10px">
          <div><span style="color:#6b7280">Invoice No: </span><b>${data.number}</b></div>
          <div><span style="color:#6b7280">Date: </span><b>${data.date.slice(0,10)}</b></div>
          <div><span style="color:#6b7280">Due: </span><b>${data.due_date?.slice(0,10) ?? '—'}</b></div>
          ${data.reference ? `<div><span style="color:#6b7280">Ref: </span><b>${data.reference}</b></div>` : ''}
        </div>
        <table>
          <thead><tr>
            <th>Product</th><th>Model / Description</th>
            <th class="r">Qty</th><th class="r">Price</th><th class="r">Disc.</th><th class="r">Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summary-wrap"><div class="summary">
          <div class="summary-row"><span>Gross</span><span>${fmt(data.gross_amount)}</span></div>
          <div class="summary-row"><span>Discount</span><span>${fmt(data.discount)}</span></div>
          <div class="summary-row"><span>Tax</span><span>${fmt(data.tax_amount)}</span></div>
          <div class="summary-row total"><span>Net (PKR)</span><span>${fmt(data.net_amount)}</span></div>
          <div class="summary-row"><span>Received</span><span>${fmt(data.paid_amount)}</span></div>
        </div></div>
        <div style="padding:16px 0 8px">
          <div style="display:inline-block;text-align:center">
            ${signatureHtml}
            ${coLogo ? `<div style="margin-top:14px"><img src="${coLogo}" style="max-width:120px;max-height:70px;object-fit:contain" /></div>` : ''}
          </div>
        </div>
        <div class="footer">Thank you for your business!</div>
        <script>window.onload=function(){window.focus();window.print();}<\/script>
        </body></html>`;
    } else if (tpl === 'si-sidebar') {
      html = buildSidebar();
    } else if (stdConfigs[tpl]) {
      html = buildStandard(stdConfigs[tpl]);
    } else {
      // ── Professional Default template (fallback) ─────────────────
      const balanceDue = Number(data.net_amount) - Number(data.paid_amount);
      const rows = lines.map((l, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="product">${l.product_name ?? l.description ?? '—'}${l.description && l.product_name ? `<br><span class="desc">${l.description}</span>` : ''}</td>
          <td class="r">${Number(l.quantity).toFixed(2)}</td>
          <td class="r">${Number(l.unit_price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td class="r">${Number(l.discount_pct).toFixed(2)}%</td>
          <td class="r amt">${fmt(l.amount)}</td>
        </tr>`).join('') || `<tr><td colspan="6" class="empty">No line items</td></tr>`;

      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${data.number}</title>
        <style>
          @page{margin:0;size:A4}
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;background:#fff;font-size:11px}
          /* ── Header ── */
          .hdr{padding:32px 40px 22px;border-bottom:3px solid ${coColor};display:flex;justify-content:space-between;align-items:flex-start}
          .co-name{font-size:26px;font-weight:800;color:${coColor};letter-spacing:-0.5px}
          .co-tag{font-size:9.5px;color:#9ca3af;margin-top:3px}
          .inv-badge{text-align:right}
          .inv-title{font-size:30px;font-weight:800;color:${coColor};letter-spacing:5px;text-transform:uppercase}
          .inv-num{font-size:13px;font-weight:700;color:#374151;margin-top:4px}
          /* ── Info band ── */
          .info-band{padding:20px 40px;background:#f8fafc;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
          .bill-box{background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;min-width:210px}
          .lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px}
          .val{font-size:12px;font-weight:700;color:#1f2937}
          .sub{font-size:10px;color:#6b7280;margin-top:3px;line-height:1.4}
          .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 40px}
          /* ── Table ── */
          .tbl-wrap{padding:24px 40px 0}
          table{width:100%;border-collapse:collapse}
          thead tr{background:${coColor}}
          th{padding:10px 12px;color:#fff;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;text-align:left}
          th.r{text-align:right}
          tbody tr:nth-child(even){background:#f8fafc}
          td{padding:9px 12px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#374151;vertical-align:top}
          td.num{color:#9ca3af;width:28px}
          td.product{font-weight:600;color:#1f2937}
          td.r{text-align:right;font-family:'Courier New',monospace}
          td.amt{font-weight:700;color:${coColor}}
          .desc{font-size:9.5px;color:#9ca3af;font-weight:400}
          td.empty{text-align:center;color:#9ca3af;padding:24px;font-style:italic}
          /* ── Bottom ── */
          .bottom{padding:20px 40px 36px;display:flex;justify-content:space-between;align-items:flex-start;margin-top:8px}
          .notes-area{max-width:290px}
          .notes-text{font-size:10px;color:#6b7280;border-left:3px solid #bfdbfe;padding-left:10px;line-height:1.6;margin-top:6px}
          .totals{width:270px}
          .t-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:11px}
          .t-row .tl{color:#6b7280}
          .t-row .tv{font-family:'Courier New',monospace;color:#1f2937}
          .t-net{background:${coColor};color:#fff;padding:11px 14px;border-radius:6px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700}
          .t-net .tl{color:#bfdbfe;font-weight:600}
          .t-net .tv{color:#fff;font-size:15px}
          .t-bal{display:flex;justify-content:space-between;padding:6px 0;font-size:11px;font-weight:700;color:#dc2626;margin-top:4px}
          .t-recv{display:flex;justify-content:space-between;padding:6px 0;font-size:11px;border-bottom:1px solid #f3f4f6}
          .t-recv .tl{color:#6b7280}
          .t-recv .tv{font-family:'Courier New',monospace}
          /* ── Footer ── */
          .footer{margin:0 40px;padding:14px 0;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
          .footer-l{font-size:9.5px;color:#9ca3af}
          .footer-r{font-size:9.5px;font-weight:700;color:${coColor}}
          .thank-banner{background:${coColor};color:#fff;text-align:center;padding:13px;font-size:11px;font-weight:700;letter-spacing:3px;margin-top:6px}
          @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
        </style></head><body>

        <div class="hdr">
          <div style="display:flex;align-items:center;gap:16px">
            ${logoHtmlLarge}
            <div>
              ${showName ? `<div class="co-name">${coName}</div>` : ''}
              ${metaHtml('#9ca3af', 9.5)}
            </div>
          </div>
          <div class="inv-badge">
            <div class="inv-title">Invoice</div>
            <div class="inv-num">${data.number}</div>
          </div>
        </div>

        <div class="info-band">
          <div class="bill-box">
            <div class="lbl">Bill To</div>
            <div class="val">${data.customer_name}</div>
            ${customerAddr ? `<div class="sub">${customerAddr}</div>` : ''}
          </div>
          <div class="meta-grid">
            <div>
              <div class="lbl">Invoice Date</div>
              <div class="val">${data.date.slice(0,10)}</div>
            </div>
            <div>
              <div class="lbl">Due Date</div>
              <div class="val">${data.due_date?.slice(0,10) ?? '—'}</div>
            </div>
            <div>
              <div class="lbl">Invoice No.</div>
              <div class="val">${data.number}</div>
            </div>
            ${data.reference ? `<div><div class="lbl">Reference</div><div class="val">${data.reference}</div></div>` : ''}
          </div>
        </div>

        <div class="tbl-wrap">
          <table>
            <thead><tr>
              <th>#</th>
              <th>Product / Description</th>
              <th class="r">Qty</th>
              <th class="r">Unit Price</th>
              <th class="r">Disc.</th>
              <th class="r">Amount (PKR)</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="bottom">
          <div class="notes-area">
            <div class="lbl">Notes &amp; Terms</div>
            <div class="notes-text">${data.notes || 'Thank you for your business. Payment is due by the due date shown above. Please include the invoice number on your payment.'}</div>
            <div style="margin-top:24px;text-align:center">
              ${signatureHtml}
            </div>
          </div>
          <div class="totals">
            <div class="t-row"><span class="tl">Subtotal</span><span class="tv">${fmt(data.gross_amount)}</span></div>
            <div class="t-row"><span class="tl">Discount</span><span class="tv">− ${fmt(data.discount)}</span></div>
            <div class="t-row"><span class="tl">Tax</span><span class="tv">${fmt(data.tax_amount)}</span></div>
            <div class="t-net"><span class="tl">Net Amount (PKR)</span><span class="tv">${fmt(data.net_amount)}</span></div>
            <div class="t-recv"><span class="tl">Amount Received</span><span class="tv">${fmt(data.paid_amount)}</span></div>
            ${balanceDue > 0 ? `<div class="t-bal"><span>Balance Due</span><span>${fmt(balanceDue)}</span></div>` : ''}
          </div>
        </div>

        <div class="footer">
          <div class="footer-l">Printed: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; ${data.number}</div>
          <div class="footer-r">${coName}</div>
        </div>
        <div class="thank-banner">THANK YOU FOR YOUR BUSINESS</div>
        <script>window.onload=function(){window.focus();window.print();}<\/script>
        </body></html>`;
    }
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function submitComment() {
    if (!comment.trim()) return;
    setActivityLog(prev => [...prev, { text: comment.trim(), date: new Date().toLocaleString() }]);
    setComment('');
  }

  return (
    <div className="w-full flex flex-col bg-white">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-900">
              Sale Invoices - [{data.number}]
            </h2>
            <span className={`rounded px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${SI_STATUS_COLORS[data.status]}`}>
              {SI_STATUS_LABELS[data.status]}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {loading && (
            <div className="flex justify-center py-10">
              <svg className="h-7 w-7 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          )}

          {/* ── Info grid ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-6 text-sm">
            {/* Left */}
            <div className="space-y-2">
              <Row label="Customer"  value={data.customer_name} highlight />
              <Row label="Number"    value={data.number} />
              <Row label="Address" value={customerAddress} />
              <Row label="Reference" value={data.reference ?? '—'} />
              {data.subject && <Row label="Subject" value={data.subject} />}
            </div>
            {/* Right */}
            <div className="space-y-2 text-right">
              <Row label="Date"     value={data.date.slice(0, 10)} right />
              <Row label="Due Date" value={data.due_date?.slice(0, 10) ?? '—'} right
                highlight={!!data.is_overdue} />
            </div>
          </div>

          {/* ── Line items table ───────────────────────────────────────────── */}
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Product</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Warehouse</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Quantity</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Price</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Disc.</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.length === 0 && !loading ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No line items</td></tr>
                ) : lines.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-800">{l.product_name ?? l.description}</td>
                    <td className="px-4 py-2.5 text-gray-500">Default</td>
                    <td className="px-4 py-2.5 text-right text-gray-700 font-mono">{Number(l.quantity).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700 font-mono">{Number(l.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500 font-mono">{Number(l.discount_pct).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">{fmt(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Product/Qty summary */}
          {lines.length > 0 && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">No. of Product:</span> {uniqueProducts}
              &nbsp;&nbsp;
              <span className="font-medium">Total Quantity:</span> {totalQty.toFixed(2)}
            </p>
          )}

          {/* ── Comments / Notes ───────────────────────────────────────────── */}
          {data.notes && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Comments</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded border border-gray-200 px-3 py-2">{data.notes}</p>
            </div>
          )}

          {/* ── Attachments placeholder ─────────────────────────────────────── */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Attachments</p>
            <div className="rounded-lg border-2 border-dashed border-gray-300 px-6 py-8 flex flex-col items-center gap-2 text-sm text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
              </svg>
              Drop files here or <span className="text-blue-600 font-semibold cursor-pointer">BROWSE FILES</span>
            </div>
          </div>

          {/* ── Summary + Received ─────────────────────────────────────────── */}
          <div className="flex justify-end">
            <div className="w-72 border border-gray-200 rounded-lg overflow-hidden text-sm">
              <SummaryRow label="Gross"      value={fmt(data.gross_amount)} />
              <SummaryRow label="Discount"   value={fmt(data.discount)} />
              <SummaryRow label="Tax"        value={fmt(data.tax_amount)} />
              <SummaryRow label="Net (PKR)"  value={fmt(data.net_amount)} bold />
              <div className="border-t-2 border-gray-300" />
              <SummaryRow label="Received"     value={fmt(data.paid_amount)} />
              <SummaryRow label="Cash Returned" value={fmt(Math.max(0, Number(data.paid_amount) - Number(data.net_amount)))} />
            </div>
          </div>

          {/* ── Activity Log ───────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Activity Log</p>
              <button className="text-sm text-blue-600 border border-blue-200 rounded px-3 py-1 hover:bg-blue-50">+ SHOW</button>
            </div>
            {activityLog.length > 0 && (
              <div className="mb-3 space-y-2">
                {activityLog.map((a, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm">
                    <p className="text-gray-800">{a.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.date}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Comment / Description"
                rows={3}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
              <button onClick={submitComment}
                className="self-end text-gray-400 hover:text-green-500 transition-colors pb-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer buttons ──────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          {/* Left action buttons */}
          <div className="flex items-center gap-2">
            {['draft', 'approved', 'partially_paid'].includes(data.status) && (
              <button onClick={handleVoid} disabled={actioning}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                VOID
              </button>
            )}
            {data.status === 'draft' && (
              <button onClick={handleApprove} disabled={actioning}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                APPROVE
              </button>
            )}
            {data.status === 'draft' && (
              <button onClick={onEdit}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                EDIT
              </button>
            )}
            <button onClick={() => {/* create return */}}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              CREATE RETURN
            </button>

            {/* PRINT with dropdown */}
            <div className="relative" ref={printDdRef}>
              <div className="flex rounded overflow-hidden">
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  PRINT
                </button>
                <button onClick={() => setShowPrintDd(v => !v)}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-2 py-2 border-l border-blue-500">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                </button>
              </div>
              {showPrintDd && (
                <div className="absolute bottom-full mb-1 left-0 z-20 w-44 bg-white border border-gray-200 rounded shadow-lg py-1">
                  <button onClick={() => { setShowPrintDd(false); handlePrint(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Print Invoice</button>
                  <button onClick={() => { setShowPrintDd(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Print Receipt</button>
                </div>
              )}
            </div>
          </div>

          {/* CLOSE */}
          <button onClick={onClose}
            className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-2 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            CLOSE
          </button>
        </div>
    </div>
  );
}

/* ── Small helper components ──────────────────────────────────────────── */
function Row({ label, value, highlight = false, right = false }: { label: string; value: string; highlight?: boolean; right?: boolean }) {
  return (
    <div className={`flex gap-2 ${right ? 'justify-end' : ''}`}>
      <span className="text-gray-500 font-medium whitespace-nowrap">{label}:</span>
      <span className={highlight ? 'text-blue-600 font-semibold' : 'text-gray-800'}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between px-4 py-2 ${bold ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-gray-700'}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
