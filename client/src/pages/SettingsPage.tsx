import { useState, useEffect } from 'react';
import { getCompanySettings, updateCompanySettings } from '../api/companySettings';
import { validatePositive } from '../utils/validators';

const TEMPLATES_KEY = 'evotrade_printing_templates_v2';
const IMAGES_KEY    = 'evotrade_company_images';

type SettingsTab = 'settings' | 'salesperson' | 'smtp' | 'whatsapp' | 'apikeys' | 'templates' | 'program';

export default function SettingsPage() {
  const activeBiz = (() => {
    try { return JSON.parse(localStorage.getItem('evotrade_active_business') || '{}') as {name?:string;initials?:string;color?:string}; }
    catch { return {}; }
  })();

  const [activeTab,    setActiveTab]    = useState<SettingsTab>('settings');
  const [coInfo,       setCoInfo]       = useState<Record<string,string>>({});
  const [coLogo,       setCoLogo]       = useState<string|null>(null);

  // Currency & Account settings (persisted via company_settings)
  const [homeCurrency,        setHomeCurrency]        = useState('');
  const [multiCurrency,       setMultiCurrency]       = useState(false);
  const [currencyDisplay,     setCurrencyDisplay]     = useState<'symbol' | 'code'>('code');
  const [decimalPlaces,       setDecimalPlaces]       = useState('2');
  const [fiscalYearStart,     setFiscalYearStart]     = useState('');
  const [enableNarration,     setEnableNarration]     = useState(false);
  const [reduceCostOnPurchaseDiscount, setReduceCostOnPurchaseDiscount] = useState(false);
  const [reduceSaleOnSaleDiscount,     setReduceSaleOnSaleDiscount]     = useState(false);

  // Printing Templates state
  const [activeTemplateTab, setActiveTemplateTab] = useState('Sale Invoice');
  const [showTemplateCustomizer, setShowTemplateCustomizer] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<{name: string; type: string} | null>(null);

  // Customer Program state
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyEarnAmount, setLoyaltyEarnAmount] = useState('');
  const [loyaltyRedeemAmount, setLoyaltyRedeemAmount] = useState('');
  const [loyaltyExpenseAccount, setLoyaltyExpenseAccount] = useState('');
  const [loyaltyCustomerCategories, setLoyaltyCustomerCategories] = useState('');
  const [loyaltyCalculation, setLoyaltyCalculation] = useState<'ceiling' | 'floor' | 'round'>('ceiling');
  const [loyaltyErrors, setLoyaltyErrors] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<Record<string, Array<{id: string; name: string; type: 'default' | 'custom'; active: boolean}>>>({
    'Sale Quotation': [
      { id: 'sq-default', name: 'Default', type: 'default', active: true },
      { id: 'sq-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Sale Order': [
      { id: 'so-default', name: 'Default', type: 'default', active: true },
      { id: 'so-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Sale Invoice': [
      { id: 'si-default', name: 'Default', type: 'default', active: true },
      { id: 'si-model', name: 'Model # & Brand', type: 'default', active: false },
      { id: 'si-classic', name: 'Classic', type: 'default', active: false },
      { id: 'si-total', name: 'Total Highlight', type: 'default', active: false },
      { id: 'si-boldstar', name: 'Bold Accent', type: 'default', active: false },
      { id: 'si-sidebar', name: 'Sidebar', type: 'default', active: false },
      { id: 'si-wave', name: 'Blue Wave', type: 'default', active: false },
      { id: 'si-vintage', name: 'Vintage', type: 'default', active: false },
      { id: 'si-bluebar', name: 'Blue Bar', type: 'default', active: false },
      { id: 'si-minimal', name: 'Minimal', type: 'default', active: false },
      { id: 'si-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Sale Delivery': [
      { id: 'sd-default', name: 'Default', type: 'default', active: true },
      { id: 'sd-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Sale Return': [
      { id: 'sr-default', name: 'Default', type: 'default', active: true },
      { id: 'sr-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Receive Payment': [
      { id: 'rp-default', name: 'Default', type: 'default', active: true },
      { id: 'rp-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Purchase Order': [
      { id: 'po-default', name: 'Default', type: 'default', active: true },
      { id: 'po-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Make Payment': [
      { id: 'mp-default', name: 'Default', type: 'default', active: true },
      { id: 'mp-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Purchase Invoice': [
      { id: 'pi-default', name: 'Default', type: 'default', active: true },
      { id: 'pi-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'POS Invoice': [
      { id: 'pos-default', name: 'Default', type: 'default', active: true },
      { id: 'pos-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
    'Other Collection': [
      { id: 'oc-default', name: 'Default', type: 'default', active: true },
      { id: 'oc-custom', name: 'Custom Template', type: 'custom', active: false },
    ],
  });

  // Load templates, company settings and logo on mount
  useEffect(() => {
    const saved = localStorage.getItem(TEMPLATES_KEY);
    if (saved) {
      try {
        const savedTemplates = JSON.parse(saved);
        // Merge: always use the full default list (so new templates appear),
        // but preserve the user's previously-selected active template per doc type.
        setTemplates(prev => {
          const merged: typeof prev = {};
          for (const docType of Object.keys(prev)) {
            const savedList: Array<{id: string; active: boolean}> = savedTemplates[docType] || [];
            const savedActiveId = savedList.find(t => t.active)?.id;
            const hasActive = savedActiveId && prev[docType].some(t => t.id === savedActiveId);
            merged[docType] = prev[docType].map(t => ({
              ...t,
              active: hasActive ? t.id === savedActiveId : t.active,
            }));
          }
          return merged;
        });
      } catch {}
    }
    getCompanySettings().then(d => {
      setCoInfo(d);
      setHomeCurrency(d.home_currency ?? '');
      setMultiCurrency(d.multi_currency === 'true');
      setCurrencyDisplay(d.currency_display === 'symbol' ? 'symbol' : 'code');
      setDecimalPlaces(d.decimal_places ?? '2');
      setFiscalYearStart(d.fiscal_year_start ?? '');
      setEnableNarration(d.enable_narration === 'true');
      setReduceCostOnPurchaseDiscount(d.reduce_cost_on_purchase_discount === 'true');
      setReduceSaleOnSaleDiscount(d.reduce_sale_on_sale_discount === 'true');
    }).catch(() => {});
    try {
      const imgs = JSON.parse(localStorage.getItem(IMAGES_KEY) || '{}');
      if (imgs.profile) setCoLogo(imgs.profile);
    } catch {}
  }, []);

  const [templateSettings, setTemplateSettings] = useState<Record<string, Record<string, boolean>>>({
    'Sale Quotation': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': false,
      'Reference Number': false,
      'Customer Name': true,
      'Customer Address': false,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': true,
      'Product Code': false,
      'Quantity': true,
      'Unit Price': true,
      'Amount': true,
      'Subtotal': true,
      'Tax': false,
      'Discount': false,
      'Total Amount': true,
      'Notes': false,
      'Terms & Conditions': false,
      'Company Signature': false,
      'Authorized By': false,
    },
    'Sale Order': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': true,
      'Reference Number': false,
      'Customer Name': true,
      'Customer Address': true,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': true,
      'Product Code': true,
      'Quantity': true,
      'Unit Price': true,
      'Amount': true,
      'Subtotal': true,
      'Tax': true,
      'Discount': false,
      'Total Amount': true,
      'Notes': true,
      'Terms & Conditions': true,
      'Company Signature': false,
      'Authorized By': true,
    },
    'Sale Invoice': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': true,
      'Company Contact': true,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': true,
      'Reference Number': false,
      'Customer Name': true,
      'Customer Address': true,
      'Contact Person': true,
      'Phone Number': true,
      'Email': false,
      'Product Name': true,
      'Product Code': true,
      'Quantity': true,
      'Unit Price': true,
      'Amount': true,
      'Subtotal': true,
      'Tax': true,
      'Discount': true,
      'Total Amount': true,
      'Notes': true,
      'Terms & Conditions': true,
      'Company Signature': true,
      'Authorized By': true,
    },
    'Sale Delivery': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': false,
      'Document Number': true,
      'Document Date': true,
      'Due Date': false,
      'Reference Number': true,
      'Customer Name': true,
      'Customer Address': true,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': true,
      'Product Code': false,
      'Quantity': true,
      'Unit Price': false,
      'Amount': false,
      'Subtotal': false,
      'Tax': false,
      'Discount': false,
      'Total Amount': false,
      'Notes': false,
      'Terms & Conditions': false,
      'Company Signature': true,
      'Authorized By': false,
    },
    'Sale Return': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': false,
      'Reference Number': true,
      'Customer Name': true,
      'Customer Address': false,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': true,
      'Product Code': true,
      'Quantity': true,
      'Unit Price': true,
      'Amount': true,
      'Subtotal': true,
      'Tax': true,
      'Discount': false,
      'Total Amount': true,
      'Notes': true,
      'Terms & Conditions': false,
      'Company Signature': true,
      'Authorized By': true,
    },
    'Receive Payment': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': false,
      'Reference Number': true,
      'Customer Name': true,
      'Customer Address': false,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': false,
      'Product Code': false,
      'Quantity': false,
      'Unit Price': false,
      'Amount': false,
      'Subtotal': false,
      'Tax': false,
      'Discount': false,
      'Total Amount': true,
      'Notes': true,
      'Terms & Conditions': false,
      'Company Signature': true,
      'Authorized By': true,
    },
    'Purchase Order': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': true,
      'Reference Number': false,
      'Customer Name': true,
      'Customer Address': true,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': true,
      'Product Code': true,
      'Quantity': true,
      'Unit Price': true,
      'Amount': true,
      'Subtotal': true,
      'Tax': true,
      'Discount': false,
      'Total Amount': true,
      'Notes': true,
      'Terms & Conditions': true,
      'Company Signature': true,
      'Authorized By': true,
    },
    'Make Payment': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': false,
      'Reference Number': true,
      'Customer Name': true,
      'Customer Address': false,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': false,
      'Product Code': false,
      'Quantity': false,
      'Unit Price': false,
      'Amount': false,
      'Subtotal': false,
      'Tax': false,
      'Discount': false,
      'Total Amount': true,
      'Notes': true,
      'Terms & Conditions': false,
      'Company Signature': true,
      'Authorized By': true,
    },
    'Purchase Invoice': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': true,
      'Company Contact': true,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': true,
      'Reference Number': true,
      'Customer Name': true,
      'Customer Address': true,
      'Contact Person': true,
      'Phone Number': true,
      'Email': false,
      'Product Name': true,
      'Product Code': true,
      'Quantity': true,
      'Unit Price': true,
      'Amount': true,
      'Subtotal': true,
      'Tax': true,
      'Discount': true,
      'Total Amount': true,
      'Notes': true,
      'Terms & Conditions': true,
      'Company Signature': true,
      'Authorized By': true,
    },
    'POS Invoice': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': false,
      'Document Number': true,
      'Document Date': true,
      'Due Date': false,
      'Reference Number': false,
      'Customer Name': false,
      'Customer Address': false,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': true,
      'Product Code': false,
      'Quantity': true,
      'Unit Price': true,
      'Amount': true,
      'Subtotal': true,
      'Tax': true,
      'Discount': true,
      'Total Amount': true,
      'Notes': false,
      'Terms & Conditions': false,
      'Company Signature': false,
      'Authorized By': false,
    },
    'Other Collection': {
      'Company Name': true,
      'Company Logo': true,
      'Company Address': false,
      'Company Contact': false,
      'Company NTN': true,
      'Document Number': true,
      'Document Date': true,
      'Due Date': false,
      'Reference Number': true,
      'Customer Name': true,
      'Customer Address': false,
      'Contact Person': false,
      'Phone Number': false,
      'Email': false,
      'Product Name': false,
      'Product Code': false,
      'Quantity': false,
      'Unit Price': false,
      'Amount': false,
      'Subtotal': false,
      'Tax': false,
      'Discount': false,
      'Total Amount': true,
      'Notes': true,
      'Terms & Conditions': false,
      'Company Signature': true,
      'Authorized By': true,
    },
  });

  // WhatsApp modal states
  const [showWhatsAppBusinessModal, setShowWhatsAppBusinessModal] = useState(false);
  const [showWhatsAppAccountModal, setShowWhatsAppAccountModal] = useState(false);
  const [whatsappBusinessForm, setWhatsappBusinessForm] = useState({
    whatsapp_id: '',
    pin: '',
    phone_id: '',
    token: '',
  });
  const [whatsappAccountForm, setWhatsappAccountForm] = useState({
    phone_number: '',
  });

  // API Keys state
  const [apiKeySearch, setApiKeySearch] = useState('');
  const [apiKeys, setApiKeys] = useState([
    { id: 1, name: 'whatsapp', key: '4ab37fd641a747ea84f575099cec7fe5', secret: '38Fcs4baSAbfJ4EC2AG4MXeW5KkkgP8AdjPGgSfBSPkho9mNNSi9ECcfNju2byFMCMquokfkcJWBNE7VBxf', status: 'Active', enabled: true },
  ]);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showApiKeyLimitModal, setShowApiKeyLimitModal] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  };

  const handleRegenerateApiKey = () => {
    if (!selectedApiKey) return;
    const newKey = Math.random().toString(36).substring(2, 38);
    const newSecret = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    setApiKeys(apiKeys.map(k => k.id === selectedApiKey.id ? {...k, key: newKey, secret: newSecret} : k));
    setSelectedApiKey({...selectedApiKey, key: newKey, secret: newSecret});
    showToast('Regenerate Api Key - Api key has been generated successfully.');
  };

  const handleToggleApiKey = (id: number, newState: boolean) => {
    setApiKeys(apiKeys.map(k => k.id === id ? {...k, enabled: newState} : k));
    if (selectedApiKey?.id === id) {
      setSelectedApiKey({...selectedApiKey, enabled: newState});
    }
    const action = newState ? 'Activate' : 'Deactivate';
    showToast(`${action} Api Key - Api key has been ${newState ? 'activated' : 'deactivated'} successfully.`);
  };

  const handleSave = () => {
    if (activeTab === 'settings') {
      updateCompanySettings({
        home_currency: homeCurrency,
        multi_currency: String(multiCurrency),
        currency_display: currencyDisplay,
        decimal_places: decimalPlaces,
        fiscal_year_start: fiscalYearStart,
        enable_narration: String(enableNarration),
        reduce_cost_on_purchase_discount: String(reduceCostOnPurchaseDiscount),
        reduce_sale_on_sale_discount: String(reduceSaleOnSaleDiscount),
      }).then(setCoInfo).catch(() => showToast('Failed to save settings.', 'error'));
    }
    if (activeTab === 'program' && loyaltyEnabled) {
      const errs: Record<string, string> = {};
      const earnErr = validatePositive(Number(loyaltyEarnAmount || 0), 'Earn amount');
      if (!loyaltyEarnAmount.trim() || earnErr) errs.earn = !loyaltyEarnAmount.trim() ? 'Earn amount is required.' : earnErr;
      const redeemErr = validatePositive(Number(loyaltyRedeemAmount || 0), 'Redeem amount');
      if (!loyaltyRedeemAmount.trim() || redeemErr) errs.redeem = !loyaltyRedeemAmount.trim() ? 'Redeem amount is required.' : redeemErr;
      if (!loyaltyExpenseAccount.trim()) errs.expenseAccount = 'Expense account is required.';
      setLoyaltyErrors(errs);
      if (Object.keys(errs).length > 0) { showToast('Please fix the highlighted fields before saving.', 'error'); return; }
    }
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    showToast('Settings saved successfully.');
  };

  const handleBack = () => {
    window.history.back();
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'settings', label: 'Settings' },
    { id: 'salesperson', label: 'Sales Person' },
    { id: 'smtp', label: 'SMTP' },
    { id: 'whatsapp', label: 'WhatsApp Setting' },
    { id: 'apikeys', label: 'API Keys' },
    { id: 'templates', label: 'Printing Templates' },
    { id: 'program', label: 'Customer Program' },
  ];

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  const coName = coInfo.company_name || activeBiz.name || 'My Business';
  const coAddr = [coInfo.address, coInfo.city].filter(Boolean).join(', ') || '4490 Oak Drive, Albany';

  const renderTemplateThumbnail = (template: {id: string; name: string; type: 'default' | 'custom'; active: boolean}) => {
    if (template.type === 'custom') {
      return (
        <div className="flex flex-col items-center px-6 text-center">
          <svg className="w-24 h-24 text-blue-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-base text-gray-700 font-semibold">Customize your own Template</p>
          <p className="text-sm text-gray-400 mt-1">by choosing the fields of your choice</p>
        </div>
      );
    }

    const logoEl = coLogo
      ? <img src={coLogo} className="w-6 h-6 object-contain rounded bg-white" />
      : <div className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: activeBiz.color || '#059669' }}>{activeBiz.initials || '?'}</div>;

    if (template.id.endsWith('-model')) {
      return (
        <div className="w-44 h-60 bg-white shadow-lg rounded border border-gray-200 overflow-hidden flex flex-col text-[6px] leading-tight">
          <div className="bg-slate-800 text-white px-2 py-1.5 flex items-center justify-between">
            <div><div className="font-bold text-[7px]">{coName}</div><div className="text-slate-300 text-[5px]">{coAddr}</div></div>
            {logoEl}
          </div>
          <div className="bg-green-500 text-white text-center py-0.5 font-bold text-[6px] tracking-widest">SALE INVOICE</div>
          <div className="grid grid-cols-2 px-2 py-1 bg-slate-50 border-b border-gray-200 gap-x-2">
            <div><span className="text-slate-400">No: </span>INV-001</div>
            <div className="text-right"><span className="text-slate-400">Date: </span>2026-05-18</div>
            <div><span className="text-slate-400">To: </span><span className="font-semibold">Cust Name</span></div>
          </div>
          <div className="flex-1 px-2 py-1">
            <div className="flex border-b border-gray-300 pb-0.5 mb-0.5 font-bold text-slate-700 bg-slate-100 px-0.5">
              <span className="flex-1">Item</span><span className="w-10 text-right">Model</span><span className="w-6 text-right">Qty</span><span className="w-8 text-right">Amt</span>
            </div>
            {[['Product A','M-001'],['Product B','M-002'],['Product C','M-003']].map(([item,model],i) => (
              <div key={i} className={`flex border-b border-gray-100 py-0.5 ${i%2===1?'bg-slate-50':''}`}>
                <span className="flex-1 text-gray-700">{item}</span><span className="w-10 text-right text-blue-600">{model}</span>
                <span className="w-6 text-right text-gray-500">{(i+1)*5}</span><span className="w-8 text-right text-gray-700">{(i+1)*500}</span>
              </div>
            ))}
          </div>
          <div className="px-2 py-1 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>4,500</span></div>
            <div className="flex justify-between font-bold text-gray-800 border-t border-gray-300 mt-0.5 pt-0.5"><span>Total</span><span>4,725</span></div>
          </div>
          <div className="bg-green-500 text-white text-center py-0.5 text-[5px]">Thank you for your business!</div>
        </div>
      );
    }

    if (template.id.endsWith('-classic')) {
      return (
        <div className="w-44 h-60 bg-white shadow-lg rounded border border-gray-200 overflow-hidden flex flex-col text-[5px] leading-tight">
          <div className="px-2 pt-1.5 pb-1">
            <div className="font-bold text-[7px]">{coName}</div>
            <div className="text-gray-500">{coAddr}</div>
          </div>
          <div className="grid grid-cols-2 px-2 py-1 border-t border-b border-gray-300 gap-x-2 bg-gray-50">
            <div>
              <div className="font-bold text-[4px] uppercase text-gray-600 mb-0.5">Bill To</div>
              <div className="text-gray-700">Jessie M Home</div><div className="text-gray-500">4312 Wood Road</div><div className="text-gray-500">New York, NY 10031</div>
            </div>
            <div>
              <div className="flex justify-between"><span className="text-gray-500">Invoice #</span><span className="font-bold">INT-001</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Date</span><span>11/02/2019</span></div>
              <div className="flex justify-between"><span className="text-gray-500">P.O.#</span><span>—</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Due Date</span><span>26/02/2019</span></div>
            </div>
          </div>
          <div className="flex-1 px-2 py-1">
            <div className="flex border-b border-gray-400 pb-0.5 mb-0.5 font-bold text-[4px]">
              <span className="w-3">Qty</span><span className="flex-1">Description</span><span className="w-9 text-right">Unit Price</span><span className="w-7 text-right">Amount</span>
            </div>
            {[['1','Front/rear brake','100.00','100.00'],['2','New set pedal','25.00','50.00'],['3','Labor 3hrs','15.00','45.00']].map(([q,d,p,a],i) => (
              <div key={i} className="flex border-b border-gray-100 py-0.5 text-gray-600 text-[4px]">
                <span className="w-3">{q}</span><span className="flex-1">{d}</span><span className="w-9 text-right">{p}</span><span className="w-7 text-right">{a}</span>
              </div>
            ))}
          </div>
          <div className="px-2 pb-1 border-t border-gray-200 text-[4px]">
            <div className="flex justify-between text-gray-500 py-0.5"><span>Subtotal</span><span>195.00</span></div>
            <div className="flex justify-between text-gray-500 py-0.5"><span>Sales Tax 5.0%</span><span>9.75</span></div>
            <div className="flex justify-between font-bold py-0.5 border-t border-gray-400 text-[5px]"><span>TOTAL</span><span>$204.75</span></div>
          </div>
          <div className="text-center italic text-[6px] text-gray-500 pb-1">John Smith</div>
        </div>
      );
    }

    if (template.id.endsWith('-total')) {
      return (
        <div className="w-44 h-60 bg-white shadow-lg rounded border border-gray-200 overflow-hidden flex flex-col text-[5px] leading-tight">
          <div className="px-2 pt-1.5 flex justify-between items-start">
            <div><div className="font-bold text-[6px]">{coName}</div><div className="text-gray-500">{coAddr}</div></div>
            <div className="bg-gray-100 border border-gray-300 rounded px-1.5 py-1 text-right">
              <div className="text-gray-500 text-[4px]">Invoice Total</div>
              <div className="font-bold text-[8px] text-gray-900">$204.75</div>
            </div>
          </div>
          <div className="grid grid-cols-2 px-2 py-1 gap-x-1 border-t border-b border-gray-300 mt-1 text-[4px]">
            <div><div className="font-bold uppercase text-gray-600">Bill To</div><div className="text-gray-700">Jessie M Home</div><div className="text-gray-500">4312 Wood Road</div></div>
            <div>
              <div className="flex justify-between"><span className="text-gray-500">Invoice #</span><span className="font-bold">INT-001</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Date</span><span>11/02/2019</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Due</span><span>26/02/2019</span></div>
            </div>
          </div>
          <div className="flex-1 px-2 py-1">
            <div className="flex border-b border-gray-300 pb-0.5 font-bold text-[4px] uppercase bg-gray-100 px-0.5">
              <span className="flex-1">Description</span><span className="w-9 text-right">Unit Price</span><span className="w-7 text-right">Amount</span>
            </div>
            {[['Front/rear brake','100.00','100.00'],['New set pedal','25.00','50.00'],['Labor 3hrs','15.00','45.00']].map(([d,p,a],i) => (
              <div key={i} className="flex border-b border-gray-100 py-0.5 text-gray-600 text-[4px]">
                <span className="flex-1">{d}</span><span className="w-9 text-right">{p}</span><span className="w-7 text-right">{a}</span>
              </div>
            ))}
          </div>
          <div className="px-2 pb-1 border-t border-gray-200 text-[4px]">
            <div className="flex justify-between text-gray-500 py-0.5"><span>Subtotal</span><span>195.00</span></div>
            <div className="flex justify-between text-gray-500 py-0.5"><span>Sales Tax 5%</span><span>9.75</span></div>
            <div className="flex justify-between font-bold py-0.5 border-t border-gray-400 text-[5px]"><span>TOTAL</span><span>$204.75</span></div>
          </div>
          <div className="text-center italic text-[5px] text-gray-500 pb-1">John Smith</div>
        </div>
      );
    }

    if (template.id.endsWith('-boldstar')) {
      return (
        <div className="w-44 h-60 shadow-lg rounded border border-gray-200 overflow-hidden flex flex-col text-[5px] leading-tight" style={{background:'#f0f0f0'}}>
          <div className="text-center py-2 px-2">
            <div className="text-[8px] font-black text-red-600 tracking-wider">★ INVOICE ★</div>
            <div className="font-black text-red-600 text-[7px] uppercase">{coName}</div>
            <div className="text-gray-600 text-[4px]">{coAddr}</div>
          </div>
          <div className="h-px bg-red-500 mx-2 mb-0.5" />
          <div className="grid grid-cols-2 px-2 py-0.5 gap-x-1 text-[4px]">
            <div><div className="text-[4px] uppercase text-red-600 font-bold">Bill To</div><div className="text-gray-700">Jessie M Home</div><div className="text-gray-500">4312 Wood Road</div></div>
            <div className="text-right"><div className="text-[4px] uppercase text-red-600 font-bold">Invoice #</div><div>INT-001</div><div className="text-[4px] uppercase text-red-600 font-bold mt-0.5">Date</div><div>11/02/2019</div></div>
          </div>
          <div className="h-px bg-red-300 mx-2 mt-0.5" />
          <div className="flex-1 px-2 py-1">
            <div className="flex py-0.5 bg-red-600 text-white px-0.5 font-bold text-[4px]">
              <span className="w-3">Qty</span><span className="flex-1">Description</span><span className="w-7 text-right">Amount</span>
            </div>
            {[['1','Front/rear brake','100.00'],['2','New pedal set','50.00'],['3','Labor 3hrs','45.00']].map(([q,d,a],i) => (
              <div key={i} className={`flex border-b border-red-100 py-0.5 text-[4px] ${i%2===1?'bg-red-50':''}`}>
                <span className="w-3 text-gray-600">{q}</span><span className="flex-1 text-gray-700">{d}</span><span className="w-7 text-right text-red-600 font-semibold">{a}</span>
              </div>
            ))}
          </div>
          <div className="px-2 pb-0.5 text-[4px]">
            <div className="flex justify-between text-gray-500"><span>Sales Tax 5%</span><span>9.75</span></div>
            <div className="flex justify-between text-red-600 font-bold text-[5px] border-t border-red-300 pt-0.5"><span>TOTAL</span><span>$204.75</span></div>
          </div>
          <div className="text-center italic text-[5px] text-gray-500 pb-1">John Smith</div>
        </div>
      );
    }

    if (template.id.endsWith('-sidebar')) {
      return (
        <div className="w-44 h-60 bg-white shadow-lg rounded border border-gray-200 overflow-hidden flex text-[4px] leading-tight">
          <div className="w-5 bg-gray-800 flex-shrink-0 flex items-center justify-center">
            <span className="text-white text-[4px] font-bold" style={{writingMode:'vertical-rl',transform:'rotate(180deg)',whiteSpace:'nowrap'}}>Invoice INT-001</span>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="px-1.5 pt-1.5 flex justify-between items-start">
              <div><div className="font-bold text-[6px]">{coName}</div><div className="text-gray-500">{coAddr}</div></div>
              {coLogo ? <img src={coLogo} className="w-5 h-5 object-contain" /> : <div className="w-5 h-5 bg-gray-200 rounded text-[3px] flex items-center justify-center text-gray-400">LOGO</div>}
            </div>
            <div className="grid grid-cols-2 px-1.5 py-0.5 bg-gray-50 border-t border-b border-gray-200 gap-x-1 mt-0.5">
              <div><div className="text-gray-400">Bill To</div><div className="font-bold text-gray-700">Jessie M Home</div><div className="text-gray-500">4312 Wood Road</div></div>
              <div><div className="text-gray-400">Invoice Date</div><div className="font-bold text-gray-900">11/02/2019</div><div className="text-red-500 font-bold">Due Date</div><div className="font-bold">26/02/2019</div></div>
            </div>
            <div className="flex-1 px-1.5 py-0.5">
              <div className="flex py-0.5 bg-red-400 text-white px-0.5 font-bold">
                <span className="flex-1">Description</span><span className="w-7 text-right">Price</span><span className="w-6 text-right">Amt</span>
              </div>
              {[['Front brake','100.00','100.00'],['Pedal set','25.00','50.00'],['Labor','15.00','45.00']].map(([d,p,a],i) => (
                <div key={i} className="flex border-b border-gray-100 py-0.5">
                  <span className="flex-1 text-gray-700">{d}</span><span className="w-7 text-right text-gray-500">{p}</span><span className="w-6 text-right text-gray-700">{a}</span>
                </div>
              ))}
            </div>
            <div className="px-1.5 pb-1 border-t border-gray-200">
              <div className="flex justify-between font-bold text-[5px] text-gray-800"><span>Total</span><span>$204.75</span></div>
              <div className="text-center italic text-[5px] text-gray-400 mt-0.5">John Smith</div>
            </div>
          </div>
        </div>
      );
    }

    if (template.id.endsWith('-wave')) {
      return (
        <div className="w-44 h-60 bg-white shadow-lg rounded border border-gray-200 overflow-hidden flex flex-col text-[5px] leading-tight">
          <div className="px-2 pt-1.5">
            <div className="font-bold text-[7px] text-blue-700">{coName}</div>
            <div className="text-gray-500">{coAddr}</div>
          </div>
          <div className="grid grid-cols-2 px-2 py-1 gap-x-2 mt-1 border-t border-b border-gray-200 text-[4px]">
            <div><div className="text-blue-500 font-bold">Bill To</div><div className="font-semibold text-gray-700">Jessie M Home</div><div className="text-gray-500">4312 Wood Road</div></div>
            <div><div className="text-blue-500 font-bold">Invoice #</div><div>INT-001</div><div className="text-blue-500 font-bold mt-0.5">Invoice Date</div><div>11/02/2019</div></div>
          </div>
          <div className="flex-1 px-2 py-1">
            <div className="flex border-b border-blue-200 pb-0.5 font-bold text-blue-700 text-[4px]">
              <span className="w-3">Qty</span><span className="flex-1">Description</span><span className="w-9 text-right">Amount</span>
            </div>
            {[['1','Front/rear brake','100.00'],['2','New pedal set','50.00'],['3','Labor 3hrs','45.00']].map(([q,d,a],i) => (
              <div key={i} className="flex border-b border-gray-100 py-0.5 text-gray-600 text-[4px]">
                <span className="w-3">{q}</span><span className="flex-1">{d}</span><span className="w-9 text-right">{a}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-blue-600 mt-1 text-[5px]"><span>Invoice Total</span><span>$204.75</span></div>
          </div>
          <div className="relative h-12 overflow-hidden flex-shrink-0">
            <svg viewBox="0 0 176 48" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              <path d="M0,20 C40,5 80,35 120,18 C150,8 165,28 176,18 L176,48 L0,48 Z" fill="#1d4ed8" opacity="0.7"/>
              <path d="M0,30 C50,14 100,38 140,26 C160,20 170,33 176,28 L176,48 L0,48 Z" fill="#2563eb" opacity="0.85"/>
              <path d="M0,38 C60,24 110,42 176,34 L176,48 L0,48 Z" fill="#3b82f6"/>
            </svg>
            <div className="absolute inset-0 flex items-end justify-center pb-1.5">
              <span className="text-white text-[4px] font-medium">Terms & Conditions — Payment due within 15 days</span>
            </div>
          </div>
        </div>
      );
    }

    if (template.id.endsWith('-vintage')) {
      return (
        <div className="w-44 h-60 shadow-lg rounded border border-gray-400 overflow-hidden flex flex-col text-[5px] leading-tight" style={{backgroundColor:'#f5e6c8'}}>
          <div className="m-1 flex-1 border-2 border-gray-700 flex flex-col" style={{borderStyle:'double'}}>
            <div className="text-center py-0.5 text-gray-700 text-[7px] tracking-widest">✦ ✦ ✦ ✦ ✦</div>
            <div className="text-center px-1">
              <div className="font-bold text-[7px] text-gray-800">{coName}</div>
              <div className="text-gray-600 text-[4px]">{coAddr}</div>
            </div>
            <div className="h-px bg-gray-600 mx-2 my-0.5" />
            <div className="grid grid-cols-2 px-2 gap-x-1 py-0.5 text-[4px]">
              <div><div className="text-gray-600 font-bold">Bill To</div><div className="text-gray-700">Jessie M Home</div><div className="text-gray-500">4312 Wood Road</div></div>
              <div className="text-right"><div className="text-gray-600">Invoice # INT-001</div><div className="text-gray-600">Date 11/02/2019</div></div>
            </div>
            <div className="h-px bg-gray-600 mx-2 my-0.5" />
            <div className="px-2 flex-1">
              <div className="flex border-b border-gray-500 pb-0.5 font-bold text-gray-700 text-[4px]">
                <span className="w-3">Qty</span><span className="flex-1">Description</span><span className="w-8 text-right">Amount</span>
              </div>
              {[['1','Front brake cables','100.00'],['2','New pedal set','50.00'],['3','Labor 3hrs','45.00']].map(([q,d,a],i) => (
                <div key={i} className="flex border-b border-gray-300 py-0.5 text-gray-700 text-[4px]">
                  <span className="w-3">{q}</span><span className="flex-1">{d}</span><span className="w-8 text-right">{a}</span>
                </div>
              ))}
            </div>
            <div className="px-2 pb-0.5 border-t border-gray-600 mt-0.5 text-[4px]">
              <div className="flex justify-between text-gray-700 py-0.5"><span>Subtotal</span><span>195.00</span></div>
              <div className="flex justify-between font-bold text-gray-800 text-[5px]"><span>INVOICE TOTAL</span><span>$204.75</span></div>
            </div>
            <div className="text-center italic text-[5px] text-gray-600 pb-0.5">John Smith</div>
            <div className="text-center text-gray-600 text-[6px] pb-0.5 tracking-widest">✦ ✦ ✦ ✦ ✦</div>
          </div>
        </div>
      );
    }

    if (template.id.endsWith('-bluebar')) {
      return (
        <div className="w-44 h-60 bg-white shadow-lg rounded border border-gray-200 overflow-hidden flex flex-col text-[5px] leading-tight">
          <div className="bg-blue-600 text-white px-2 py-1.5 flex items-center justify-between">
            <div className="font-bold text-[7px]">{coName}</div>
            <div className="font-bold text-[7px] tracking-wider">INVOICE</div>
          </div>
          <div className="px-2 pt-1 text-[4px] text-gray-500">{coAddr}</div>
          <div className="grid grid-cols-2 px-2 py-1 mt-0.5 border-t border-b border-gray-200 gap-x-2 text-[4px]">
            <div><div className="text-gray-500 font-bold">Bill To</div><div className="text-gray-700">Jessie M Home</div><div className="text-gray-500">4312 Wood Road</div></div>
            <div>
              <div className="flex justify-between text-gray-500"><span>Invoice #</span><span className="font-bold text-gray-800">INT-001</span></div>
              <div className="flex justify-between text-gray-500"><span>Date</span><span>11/02/2019</span></div>
              <div className="flex justify-between text-gray-500"><span>Due</span><span>26/02/2019</span></div>
            </div>
          </div>
          <div className="flex-1 px-2 py-1">
            <div className="flex py-0.5 text-gray-600 font-bold border-b border-gray-300 text-[4px]">
              <span className="w-3">Qty</span><span className="flex-1">Description</span><span className="w-9 text-right">Amount</span>
            </div>
            {[['1','Front/rear brake','100.00'],['2','Pedal arms','50.00'],['3','Labor 3hrs','45.00']].map(([q,d,a],i) => (
              <div key={i} className={`flex border-b border-gray-100 py-0.5 text-[4px] ${i%2===1?'bg-gray-50':''}`}>
                <span className="w-3 text-gray-600">{q}</span><span className="flex-1 text-gray-700">{d}</span><span className="w-9 text-right text-gray-700">{a}</span>
              </div>
            ))}
          </div>
          <div className="px-2 pb-0.5 border-t border-gray-200 text-[4px]">
            <div className="flex justify-between text-gray-500 py-0.5"><span>Subtotal</span><span>195.00</span></div>
            <div className="flex justify-between font-bold text-gray-800 text-[5px] border-t border-gray-300 py-0.5"><span>Total</span><span>$204.75</span></div>
          </div>
          <div className="text-center italic text-[5px] text-gray-400 pb-0.5">John Smith</div>
          <div className="bg-blue-600 h-1.5" />
        </div>
      );
    }

    if (template.id.endsWith('-minimal')) {
      return (
        <div className="w-44 h-60 bg-white shadow-lg rounded border border-gray-200 overflow-hidden flex flex-col text-[5px] leading-tight">
          <div className="px-3 pt-2 flex justify-between items-start">
            <div><div className="text-gray-700 font-medium text-[6px]">{coName}</div><div className="text-gray-400 text-[4px]">{coAddr}</div></div>
            {coLogo ? <img src={coLogo} className="w-6 h-6 rounded-full object-contain border border-gray-200" /> : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[4px] text-gray-400 font-bold">LOGO</div>}
          </div>
          <div className="px-3 mt-0.5 text-[9px] font-thin text-gray-300 tracking-widest">invoice</div>
          <div className="grid grid-cols-3 px-3 py-1 gap-x-1 border-t border-gray-100 mt-0.5 text-[4px]">
            <div><div className="text-gray-400 uppercase font-bold">From</div><div className="text-gray-600">{coName}</div></div>
            <div><div className="text-gray-400 uppercase font-bold">Invoice #</div><div className="text-gray-700">INT-001</div><div className="text-gray-400 uppercase font-bold mt-0.5">Date</div><div className="text-gray-700">11/02/19</div></div>
            <div><div className="text-gray-400 uppercase font-bold">Bill To</div><div className="text-gray-700">Jessie M.</div></div>
          </div>
          <div className="flex-1 px-3 py-0.5">
            <div className="flex border-b border-gray-200 pb-0.5 font-bold text-gray-400 text-[4px] uppercase">
              <span className="flex-1">Description</span><span className="w-8 text-right">Price</span><span className="w-7 text-right">Amt</span>
            </div>
            {[['Front brake cables','100.00','100.00'],['New set pedal arms','25.00','50.00'],['Labor 3hrs','15.00','45.00']].map(([d,p,a],i) => (
              <div key={i} className={`flex border-b border-gray-100 py-0.5 text-[4px] ${i%2===1?'bg-gray-50':''}`}>
                <span className="flex-1 text-gray-700">{d}</span><span className="w-8 text-right text-gray-500">{p}</span><span className="w-7 text-right text-gray-700">{a}</span>
              </div>
            ))}
          </div>
          <div className="px-3 pb-1 border-t border-gray-100 text-[4px]">
            <div className="flex justify-between text-gray-400 py-0.5"><span>Subtotal</span><span>195.00</span></div>
            <div className="flex justify-between text-gray-400 py-0.5"><span>Sales Tax 5%</span><span>9.75</span></div>
            <div className="border border-gray-800 px-1 py-0.5 flex justify-between font-bold text-gray-900 text-[5px] mt-0.5"><span>TOTAL</span><span>$204.75</span></div>
          </div>
          <div className="text-center italic text-gray-400 pb-1 text-[5px]">John Smith</div>
        </div>
      );
    }

    // Default thumbnail (used for all other document types + si-default)
    return (
      <div className="w-44 h-60 bg-white shadow-lg rounded border border-gray-200 overflow-hidden flex flex-col text-[6px] leading-tight">
        <div className="bg-gray-800 text-white px-2 py-1.5 flex items-center justify-between">
          <div><div className="font-bold text-[7px]">{coName}</div><div className="text-gray-300 text-[5px]">{coAddr}</div></div>
          {logoEl}
        </div>
        <div className="bg-green-500 text-white text-center py-1 font-bold text-[7px] tracking-wide">{activeTemplateTab.toUpperCase()}</div>
        <div className="flex justify-between px-2 py-1 bg-gray-50 border-b border-gray-200">
          <div><div className="text-gray-500">No: INV-001</div><div className="text-gray-500">Date: 2026-05-18</div></div>
          <div className="text-right"><div className="text-gray-500">To:</div><div className="font-semibold">Customer Name</div></div>
        </div>
        <div className="flex-1 px-2 py-1">
          <div className="flex border-b border-gray-200 pb-0.5 mb-0.5 font-bold text-gray-600">
            <span className="flex-1">Item</span><span className="w-8 text-right">Qty</span><span className="w-10 text-right">Amt</span>
          </div>
          {['Product A','Product B','Product C'].map((item,i) => (
            <div key={i} className="flex border-b border-gray-100 py-0.5 text-gray-500">
              <span className="flex-1">{item}</span><span className="w-8 text-right">{(i+1)*5}</span><span className="w-10 text-right">{(i+1)*500}</span>
            </div>
          ))}
        </div>
        <div className="px-2 py-1 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>4,500</span></div>
          <div className="flex justify-between font-bold text-gray-800 border-t border-gray-300 mt-0.5 pt-0.5"><span>Total</span><span>4,725</span></div>
        </div>
        <div className="bg-green-500 text-white text-center py-0.5 text-[5px]">Thank you for your business!</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header with Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Setup</h1>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white px-6 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              SAVE
            </button>
            <button
              onClick={handleBack}
              className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-6 py-2 rounded text-sm font-semibold transition-colors cursor-pointer"
            >
              BACK
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-green-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-7xl space-y-6">
            {/* Row 1: Currency Settings & Account Settings */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Currency Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Home Currency</label>
                    <select className={inputCls} value={homeCurrency} onChange={e => setHomeCurrency(e.target.value)}>
                      <option value="">-Choose-</option>
                      <option value="pkr">Pakistani Rupee</option>
                      <option value="usd">US Dollar</option>
                      <option value="gbp">British Pound</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" checked={multiCurrency}
                        disabled={multiCurrency}
                        onChange={e => setMultiCurrency(e.target.checked)} />
                      <span className="text-sm text-gray-700">Allow <span className="font-semibold">Multi Currency</span> <span className="text-orange-500 text-xs">(Cannot be changed once saved)</span></span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="currency_display" className="border-gray-300"
                        checked={currencyDisplay === 'symbol'} onChange={() => setCurrencyDisplay('symbol')} />
                      <span className="text-sm text-gray-700">Display Currency Symbol (Rs)</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="currency_display" className="border-gray-300"
                        checked={currencyDisplay === 'code'} onChange={() => setCurrencyDisplay('code')} />
                      <span className="text-sm text-gray-700">Display Currency Code (PKR)</span>
                    </label>
                  </div>
                  <div>
                    <label className={labelCls}>Decimal Place Limit (Up To 4)</label>
                    <input type="number" min="0" max="4" className={inputCls} value={decimalPlaces}
                      onChange={e => setDecimalPlaces(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Financial Year Start</label>
                    <select className={inputCls} value={fiscalYearStart} onChange={e => setFiscalYearStart(e.target.value)}>
                      <option value="">-Choose-</option>
                      <option value="january">January</option>
                      <option value="july">July</option>
                      <option value="october">October</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" checked={enableNarration}
                        onChange={e => setEnableNarration(e.target.checked)} />
                      <span className="text-sm text-gray-700">Enable <span className="font-semibold">Narration</span></span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" checked={reduceCostOnPurchaseDiscount}
                        onChange={e => setReduceCostOnPurchaseDiscount(e.target.checked)} />
                      <span className="text-sm text-gray-700">Reduce Cost on <span className="font-semibold">Purchase Discount</span> (By Default)</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" checked={reduceSaleOnSaleDiscount}
                        onChange={e => setReduceSaleOnSaleDiscount(e.target.checked)} />
                      <span className="text-sm text-gray-700">Reduce Sale on <span className="font-semibold">Sale Discount</span> (By Default)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Sales Settings & General Settings */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Multiple Price Level</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Multiple Discount</span> <span className="text-orange-500 text-xs">(Cannot be changed once saved)</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Schemes</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Sales Geography</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Negative Stock</span> entries</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Credit Limit Exceed</span> entries</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Image Compression</span> <span className="text-orange-500 text-xs">(For Faster Performance)</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Product Image</span> at (Sale Quotation)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Product Image</span> at (Sale Invoice)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Packing Detail</span> at (Sale Delivery/Invoice)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow <span className="font-semibold">Sales Person</span> wise Invoice filter at (Receive Payment)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Do you also want to manage the <span className="font-semibold">Available for Sale</span> quantity?</span>
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 mt-1" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Outstanding Balance</span> at (Sale Invoice/ Return/ Receive Payment/ Customer Refund PDF)</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 mt-1" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Outstanding Balance</span> at (Purchase Invoice/ Return/ Make Payment/ Vendor Refund PDF)</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 mt-1" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Transaction Number</span> at (Purchases/ Sales/ Accounts/ Manufacturing/ Products/ Inventory)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Message</span> Service</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 mt-1" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Copy Comments</span> at (Sales Quotation / Sales Order / Sales Delivery / Sales Invoice / Sales Return)</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 mt-1" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Copy Comments</span> at (Purchases Order / Purchases Good Receiving / Purchases Invoice / Purchases Return)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Un-deposited Funds</span> forwarding</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Warehouse Locations</span></span>
                  </label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Enable <span className="font-semibold">WHT</span> on Sales</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Enable <span className="font-semibold">WHT</span> on Purchase</span>
                    </label>
                  </div>
                  <div>
                    <label className={labelCls}>Default Discount Type</label>
                    <select className={inputCls}>
                      <option value="">-Choose-</option>
                      <option value="percentage">%</option>
                      <option value="amount">Amount</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Sales / Purchase <span className="font-semibold">Order Quantity</span> Restriction</span>
                  </label>
                  <div className="space-y-2 mt-2">
                    <p className="text-sm font-medium text-gray-700">Discount Applicable On</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="discount_applicable" defaultChecked className="border-gray-300" />
                      <span className="text-sm text-gray-700">Document Wise</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="discount_applicable" className="border-gray-300" />
                      <span className="text-sm text-gray-700">Line Item / Product Wise</span>
                    </label>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 mt-1" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Customers</span> in Account Payable & <span className="font-semibold">Vendors</span> in Account Receivable</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Row 3: Batch Settings & Taxation Settings */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 mt-1" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Batch Number</span> at (Sale & Purchase Invoice / Sale & Purchase Return / Sale Delivery / Good Receiving / Stock Movement / Stock Adjustment / Job Order / Disassembling PDF)</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 mt-1" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Batch Expiry Date</span> at (Sale & Purchase Invoice/ Sale & Purchase Return / Sale Delivery / Good Receiving / Stock Movement / Stock Adjustment / Job Order / Disassembling PDF)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">batches</span> with zero quantity</span>
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Taxation Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Tax Authority</label>
                    <input
                      type="text"
                      placeholder="Type to search Tax Authority"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4: Manufacturing Settings & POS/Other Settings */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Manufacturing Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow changing input quantity at <span className="font-semibold">Job Order/Assembling</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow adding Input for <span className="font-semibold">Job Order/Assembling</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow changing Output quantity at <span className="font-semibold">Job Order/Assembling</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow adding Output for <span className="font-semibold">Job Order/Assembling</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow changing input quantity at <span className="font-semibold">Disassembling</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow adding Input for <span className="font-semibold">Disassembling</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow changing Output quantity at <span className="font-semibold">Disassembling</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Allow adding Output for <span className="font-semibold">Disassembling</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Auto <span className="font-semibold">Batch Number</span> for assembly products having batches</span>
                  </label>
                  <div className="space-y-2 mt-4">
                    <p className="text-sm font-medium text-gray-700">Job Order Calculation</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="job_order_calc" defaultChecked className="border-gray-300" />
                      <span className="text-sm text-gray-700">Method 1</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="job_order_calc" className="border-gray-300" />
                      <span className="text-sm text-gray-700">Method 2</span>
                    </label>
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      Sharing the total production cost based on percentage defined in each product.
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Groups Settings</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Enable <span className="font-semibold">Master Group</span></span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Enable <span className="font-semibold">Detail Group A</span></span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Enable <span className="font-semibold">Detail Group B</span></span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">POS Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Default POS Customer</label>
                      <input
                        type="text"
                        placeholder="Type to search"
                        className={inputCls}
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Manually manage <span className="font-semibold">End of the day</span> (EOD)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Disable <span className="font-semibold">Direct Print</span></span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Booker App Settings</h3>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">Select Number of Past Days for Deliveries</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="past_days" defaultChecked className="border-gray-300" />
                      <span className="text-sm text-gray-700">0 Day (Today)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="past_days" className="border-gray-300" />
                      <span className="text-sm text-gray-700">1 Day</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="past_days" className="border-gray-300" />
                      <span className="text-sm text-gray-700">2 Days</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Allow <span className="font-semibold">Sales Orders</span> Mark Delivered Manually</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Portal App Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-3">Notification Via</p>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input type="radio" name="notification_via" defaultChecked className="border-gray-300" />
                        <span className="text-sm text-gray-700">Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input type="radio" name="notification_via" className="border-gray-300" />
                        <span className="text-sm text-gray-700">SMS</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input type="radio" name="notification_via" className="border-gray-300" />
                        <span className="text-sm text-gray-700">WhatsApp</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input type="radio" name="notification_via" className="border-gray-300" />
                        <span className="text-sm text-gray-700">WhatsApp Business</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="notification_via" className="border-gray-300" />
                        <span className="text-sm text-gray-700">WhatsApp Local</span>
                      </label>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">Auto <span className="font-semibold">Create User</span></span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Branch</h3>
                  <button className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-semibold transition-colors mb-3 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" /></svg>
                    LINKED SUBSCRIPTIONS
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Branch</span> <span className="text-orange-500 text-xs">(Cannot be changed once saved)</span></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Row 5: Misc & Delete Company */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sale Quotation Terms</h3>
                <textarea placeholder="Terms" className={inputCls + ' min-h-[100px]'} />

                <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Sale Invoice Comments</h3>
                <textarea placeholder="Comments" className={inputCls + ' min-h-[100px]'} />

                <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Purchase Order Comments</h3>
                <textarea placeholder="Comments" className={inputCls + ' min-h-[100px]'} />

                <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Pos Invoice Comments</h3>
                <textarea placeholder="Comments" className={inputCls + ' min-h-[100px]'} />

                <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Delete Company</h3>
                <button className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
                  DELETE
                </button>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Track Consignment</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">Tracking Consignment</span></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales Person Tab */}
        {activeTab === 'salesperson' && (
          <div className="max-w-7xl">
            <div className="grid grid-cols-3 gap-6">
              {/* Sale Quotation */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sale Quotation</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Order Booker</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Delivery Person</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>

              {/* Sale Order */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sale Order</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Order Booker</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Delivery Person</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>

              {/* Sale Delivery */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sale Delivery</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Order Booker</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Delivery Person</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>

              {/* Sale Invoice */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sale Invoice</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Order Booker</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Delivery Person</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>

              {/* Sale Return */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sale Return</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Order Booker</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Delivery Person</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>

              {/* Receive Payment */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Receive Payment</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Order Booker</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Delivery Person</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>

              {/* Customer Refund */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Refund</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Order Booker</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Delivery Person</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>

              {/* POS */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">POS</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>

              {/* Other Collections */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Collections</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Show <span className="font-semibold">Salesman</span></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SMTP Tab */}
        {activeTab === 'smtp' && (
          <div className="max-w-6xl">
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">Use own address for <span className="font-semibold">emails</span></span>
              </label>

              {/* Row 1: From Display Name | From Email Address | Reply-to Email Address */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>From Display Name</label>
                  <input
                    type="text"
                    placeholder="Sender Name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>From Email Address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    placeholder="Email"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Reply-to Email Address</label>
                  <input
                    type="email"
                    placeholder="Reply-to Email"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 2: Host | Port + Enable SSL */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Host <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Host"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Port <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    placeholder="0"
                    defaultValue="0"
                    className={inputCls}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-sm text-gray-700">Enable <span className="font-semibold">SSL</span></span>
                  </label>
                </div>
              </div>

              {/* Row 3: SMTP Username | SMTP Password */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>SMTP Username</label>
                  <input
                    type="text"
                    placeholder="username"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>SMTP Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="password"
                      className={inputCls}
                    />
                    <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Setting Tab */}
        {activeTab === 'whatsapp' && (
          <div className="max-w-7xl space-y-6">
            {/* WhatsApp Business Accounts Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">WhatsApp Business Accounts</h3>
                <button
                  onClick={() => setShowWhatsAppBusinessModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  ADD WHATSAPP BUSINESS ACCOUNT
                </button>
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100">
                        Pin <span className="text-gray-400">↑↓</span>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100">
                        Phone Id <span className="text-gray-400">↑↓</span>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100">
                        Whatsapp Id <span className="text-gray-400">↑↓</span>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-orange-500 font-medium">
                        No record found
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* WhatsApp Accounts Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">WhatsApp Accounts</h3>
                <button
                  onClick={() => setShowWhatsAppAccountModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  ADD WHATSAPP ACCOUNT
                </button>
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100">
                        Phone Number <span className="text-gray-400">↑↓</span>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100">
                        API Key <span className="text-gray-400">↑↓</span>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100">
                        Token <span className="text-gray-400">↑↓</span>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100">
                        Branch <span className="text-gray-400">↑↓</span>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900 cursor-pointer hover:bg-gray-100">
                        Status <span className="text-gray-400">↑↓</span>
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-orange-500 font-medium">
                        No record found
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* WhatsApp Business Account Modal */}
            {showWhatsAppBusinessModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="fixed inset-0 bg-black/20" onClick={() => setShowWhatsAppBusinessModal(false)} />
                <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">Link to WhatsApp</h3>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className={labelCls}>WhatsApp Id <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        placeholder="WhatsApp"
                        disabled
                        className={inputCls + ' bg-gray-100 cursor-not-allowed'}
                        value={whatsappBusinessForm.whatsapp_id}
                        onChange={(e) => setWhatsappBusinessForm({...whatsappBusinessForm, whatsapp_id: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>PIN <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        placeholder=""
                        className={inputCls + ' border-green-500 focus:border-green-500'}
                        value={whatsappBusinessForm.pin}
                        onChange={(e) => setWhatsappBusinessForm({...whatsappBusinessForm, pin: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Phone Id <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        placeholder="Phone Id"
                        disabled
                        className={inputCls + ' bg-gray-100 cursor-not-allowed'}
                        value={whatsappBusinessForm.phone_id}
                        onChange={(e) => setWhatsappBusinessForm({...whatsappBusinessForm, phone_id: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Token <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        placeholder="Token"
                        disabled
                        className={inputCls + ' bg-gray-100 cursor-not-allowed'}
                        value={whatsappBusinessForm.token}
                        onChange={(e) => setWhatsappBusinessForm({...whatsappBusinessForm, token: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        const appId = '1275040180186113';
                        const redirectUri = encodeURIComponent(window.location.origin + '/#/settings/whatsapp-callback');
                        const scopes = encodeURIComponent('business_management,whatsapp_business_management,whatsapp_business_messaging');
                        const facebookAuthUrl = `https://www.facebook.com/v22.0/dialog/oauth?app_id=${appId}&client_id=${appId}&display=popup&response_type=code&scope=${scopes}&redirect_uri=${redirectUri}&config_id=1286290692880026`;
                        window.open(facebookAuthUrl, 'facebook_login', 'width=500,height=700');
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5.5-9h11v2h-11z" /></svg>
                      LOGIN WITH FACEBOOK
                    </button>
                    <button className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50">
                      ADD
                    </button>
                    <button
                      onClick={() => setShowWhatsAppBusinessModal(false)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded text-sm font-semibold transition-colors"
                    >
                      CLOSE
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp Account Modal */}
            {showWhatsAppAccountModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="fixed inset-0 bg-black/20" onClick={() => setShowWhatsAppAccountModal(false)} />
                <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">Link to WhatsApp</h3>

                  <div className="mb-6">
                    <label className={labelCls}>Phone Number <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder=""
                      className={inputCls + ' border-green-500 focus:border-green-500'}
                      value={whatsappAccountForm.phone_number}
                      onChange={(e) => setWhatsappAccountForm({...whatsappAccountForm, phone_number: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50">
                      ADD
                    </button>
                    <button
                      onClick={() => setShowWhatsAppAccountModal(false)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded text-sm font-semibold transition-colors"
                    >
                      CLOSE
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'apikeys' && (
          <div className="max-w-7xl">
            {/* Search and Create Button */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <input
                type="text"
                placeholder="Search"
                className={inputCls + ' flex-1 max-w-xs'}
                value={apiKeySearch}
                onChange={(e) => setApiKeySearch(e.target.value)}
              />
              <button
                onClick={() => setShowApiKeyLimitModal(true)}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                CREATE API KEY
              </button>
            </div>

            {/* API Keys Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Application Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Key</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-orange-500 font-medium">
                        No record found
                      </td>
                    </tr>
                  ) : (
                    apiKeys
                      .filter(api => api.name.toLowerCase().includes(apiKeySearch.toLowerCase()))
                      .map(api => (
                        <tr key={api.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-6 py-3 text-blue-600 font-medium cursor-pointer hover:underline">
                            {api.name}
                          </td>
                          <td
                            className="px-6 py-3 text-gray-700 font-mono text-xs cursor-pointer hover:text-blue-600"
                            onClick={() => {
                              setSelectedApiKey(api);
                              setShowApiKeyModal(true);
                            }}
                          >
                            {'••••••••••••••••••••••••••'}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              api.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {api.enabled ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  setSelectedApiKey(api);
                                  setShowApiKeyModal(true);
                                }}
                                className="text-gray-600 hover:text-gray-900 transition-colors"
                                title="View"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={api.enabled}
                                  onChange={(e) => handleToggleApiKey(api.id, e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className={`relative w-11 h-6 ${api.enabled ? 'bg-green-500' : 'bg-gray-300'} rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                              </label>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* API Key Modal */}
            {showApiKeyModal && selectedApiKey && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="fixed inset-0 bg-black/20" onClick={() => setShowApiKeyModal(false)} />
                <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-8">
                  <button
                    onClick={() => setShowApiKeyModal(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <h2 className="text-2xl font-semibold text-gray-900 mb-6">Api Key</h2>

                  <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-2">
                      Application name: <span className="text-green-600 font-semibold">{selectedApiKey.name}</span>
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">X-Api-Key</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={selectedApiKey.key}
                          readOnly
                          className="flex-1 bg-gray-100 border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-600"
                        />
                        <button
                          onClick={() => copyToClipboard(selectedApiKey.key)}
                          className="text-gray-600 hover:text-gray-900 transition-colors"
                          title="Copy"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">X-Api-Secret</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={selectedApiKey.secret}
                          readOnly
                          className="flex-1 bg-gray-100 border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-600"
                        />
                        <button
                          onClick={() => copyToClipboard(selectedApiKey.secret)}
                          className="text-gray-600 hover:text-gray-900 transition-colors"
                          title="Copy"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleRegenerateApiKey}
                    className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    REGENERATE
                  </button>
                </div>
              </div>
            )}

            {/* Toast Notification */}

            {/* API Key Limit Modal */}
            {showApiKeyLimitModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="fixed inset-0 bg-black/20" onClick={() => setShowApiKeyLimitModal(false)} />
                <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-8">
                  <button
                    onClick={() => setShowApiKeyLimitModal(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <h2 className="text-2xl font-semibold text-gray-900 mb-6">Api Key</h2>
                  <p className="text-blue-600 font-medium">Api key(s) limit has reached.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Printing Templates Tab */}
        {activeTab === 'templates' && !showTemplateCustomizer && (
          <div className="max-w-7xl">
            {/* Document Type Tabs */}
            <div className="flex gap-0 overflow-x-auto mb-8 border-b border-gray-200">
              {['Sale Quotation','Sale Order','Sale Invoice','Sale Delivery','Sale Return','Receive Payment','Purchase Order','Make Payment','Purchase Invoice','POS Invoice','Other Collection'].map(tab => (
                <button key={tab} onClick={() => setActiveTemplateTab(tab)}
                  className={`pb-3 px-5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTemplateTab === tab ? 'border-green-500 text-gray-900 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Template Cards Grid */}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-8">
              {templates[activeTemplateTab]?.map(template => (
                <div key={template.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow border border-gray-100">
                  {/* Large Thumbnail Area */}
                  <div className={`h-72 flex items-center justify-center border-b border-gray-100 ${template.type === 'custom' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    {renderTemplateThumbnail(template)}
                  </div>

                  {/* Card Info Footer */}
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-bold text-gray-900">{template.name}</h3>
                      <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={template.active}
                          onChange={() => setTemplates({...templates,[activeTemplateTab]:templates[activeTemplateTab].map(t => ({...t, active: t.id === template.id}))})}
                          className="sr-only peer" />
                        <div className={`relative w-12 h-6 ${template.active?'bg-green-500':'bg-gray-300'} rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${template.active?'after:translate-x-6':''}`}></div>
                      </label>
                    </div>
                    <p className={`text-xs font-semibold mb-4 ${template.active?'text-green-600':'text-gray-400'}`}>{template.active?'Selected (Active)':'Inactive'}</p>
                    <div className="flex gap-2">
                      {template.type === 'custom' && (
                        <button onClick={() => setShowTemplateCustomizer(true)}
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded text-sm font-bold transition-colors">
                          CUSTOMIZE
                        </button>
                      )}
                      <button onClick={() => { setPreviewTemplate(template); setShowPreviewModal(true); }}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded text-sm font-bold transition-colors">
                        PREVIEW
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Preview Modal */}
            {showPreviewModal && previewTemplate && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreviewModal(false)} />
                <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">{activeTemplateTab} — {previewTemplate.name}</h2>
                    <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-8 bg-gray-100 flex justify-center">
                    {previewTemplate.type === 'custom' ? (
                      <div className="bg-white w-full max-w-lg p-8 rounded shadow text-center text-gray-500">
                        <svg className="w-16 h-16 mx-auto text-blue-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="font-semibold text-gray-700 mb-2">Custom Template</p>
                        <p className="text-sm">Configure your fields using the CUSTOMIZE button to see how this template will look.</p>
                      </div>
                    ) : (
                      <div className="bg-white w-full max-w-lg shadow-lg rounded overflow-hidden text-xs">
                        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
                          <div>
                            <div className="text-lg font-bold">{coInfo.company_name || activeBiz.name || 'My Business'}</div>
                            <div className="text-gray-300 text-xs mt-1">{[coInfo.address, coInfo.city, coInfo.country].filter(Boolean).join(', ') || 'Business Address'}</div>
                            {(coInfo.phone || coInfo.ntn) && (
                              <div className="text-gray-400 text-xs">{[coInfo.phone && `Ph: ${coInfo.phone}`, coInfo.ntn && `NTN: ${coInfo.ntn}`].filter(Boolean).join(' | ')}</div>
                            )}
                          </div>
                          {coLogo
                            ? <img src={coLogo} className="w-14 h-14 rounded object-contain bg-white p-1" />
                            : <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: activeBiz.color || '#059669' }}>{activeBiz.initials || '?'}</div>}
                        </div>
                        <div className="bg-green-500 text-white text-center py-2 font-bold text-sm tracking-widest">{activeTemplateTab.toUpperCase()}</div>
                        <div className="px-6 py-4">
                          <div className="flex justify-between mb-4">
                            <div><div className="text-gray-500 text-xs mb-1">Bill To:</div><div className="font-semibold text-sm">Customer Name</div><div className="text-gray-500">456 Client Avenue</div><div className="text-gray-500">+92 300 7654321</div></div>
                            <div className="text-right"><div className="text-gray-500 text-xs mb-1">Document Info:</div><div><span className="text-gray-500">No: </span><span className="font-semibold">INV-2026-001</span></div><div><span className="text-gray-500">Date: </span><span>18 May 2026</span></div><div><span className="text-gray-500">Due: </span><span>18 Jun 2026</span></div></div>
                          </div>
                          <table className="w-full mb-4 text-xs">
                            <thead><tr className="bg-gray-100"><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
                            <tbody>
                              {['Product Alpha','Product Beta','Product Gamma'].map((p,i) => (
                                <tr key={i} className="border-b border-gray-100"><td className="px-3 py-2">{p}</td><td className="px-3 py-2 text-center">{(i+1)*10}</td><td className="px-3 py-2 text-right">Rs. {(i+1)*100}</td><td className="px-3 py-2 text-right">Rs. {(i+1)*1000}</td></tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-end">
                            <div className="w-48">
                              <div className="flex justify-between py-1 text-gray-600"><span>Subtotal:</span><span>Rs. 6,000</span></div>
                              <div className="flex justify-between py-1 text-gray-600"><span>Tax (5%):</span><span>Rs. 300</span></div>
                              <div className="flex justify-between py-1 text-gray-600"><span>Discount:</span><span>Rs. 0</span></div>
                              <div className="flex justify-between py-2 font-bold text-gray-900 border-t-2 border-gray-300 mt-1"><span>Total:</span><span>Rs. 6,300</span></div>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-200 text-gray-500 text-xs">
                            <p className="font-semibold text-gray-700 mb-1">Notes:</p>
                            <p>Thank you for your business! Payment is due within 30 days.</p>
                          </div>
                          <div className="mt-4 flex justify-between">
                            <div className="text-center"><div className="border-t border-gray-400 w-32 pt-1 text-gray-500">Customer Signature</div></div>
                            <div className="text-center"><div className="border-t border-gray-400 w-32 pt-1 text-gray-500">Authorized By</div></div>
                          </div>
                        </div>
                        <div className="bg-green-500 text-white text-center py-2 text-xs">Thank you for choosing Evotrade!</div>
                      </div>
                    )}
                  </div>
                  <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
                    <button onClick={() => setShowPreviewModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded font-semibold text-sm transition-colors">CLOSE</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Printing Templates Customizer Tab */}
        {activeTab === 'templates' && showTemplateCustomizer && (
          <div className="max-w-5xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Customize: {activeTemplateTab}</h2>
              <button onClick={() => setShowTemplateCustomizer(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded text-sm font-semibold transition-colors">BACK</button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Header</h3>
                <div className="space-y-2">
                  {['Company Name','Company Logo','Company Address','Company Contact','Company NTN'].map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={templateSettings[activeTemplateTab]?.[f]||false} onChange={e => setTemplateSettings({...templateSettings,[activeTemplateTab]:{...templateSettings[activeTemplateTab],[f]:e.target.checked}})} className="rounded border-gray-300" />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Document Info</h3>
                <div className="space-y-2">
                  {['Document Number','Document Date','Due Date','Reference Number'].map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={templateSettings[activeTemplateTab]?.[f]||false} onChange={e => setTemplateSettings({...templateSettings,[activeTemplateTab]:{...templateSettings[activeTemplateTab],[f]:e.target.checked}})} className="rounded border-gray-300" />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Customer / Vendor</h3>
                <div className="space-y-2">
                  {['Customer Name','Customer Address','Contact Person','Phone Number','Email'].map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={templateSettings[activeTemplateTab]?.[f]||false} onChange={e => setTemplateSettings({...templateSettings,[activeTemplateTab]:{...templateSettings[activeTemplateTab],[f]:e.target.checked}})} className="rounded border-gray-300" />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Line Items</h3>
                <div className="space-y-2">
                  {['Product Name','Product Code','Quantity','Unit Price','Amount'].map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={templateSettings[activeTemplateTab]?.[f]||false} onChange={e => setTemplateSettings({...templateSettings,[activeTemplateTab]:{...templateSettings[activeTemplateTab],[f]:e.target.checked}})} className="rounded border-gray-300" />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Summary</h3>
                <div className="space-y-2">
                  {['Subtotal','Tax','Discount','Total Amount'].map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={templateSettings[activeTemplateTab]?.[f]||false} onChange={e => setTemplateSettings({...templateSettings,[activeTemplateTab]:{...templateSettings[activeTemplateTab],[f]:e.target.checked}})} className="rounded border-gray-300" />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Footer</h3>
                <div className="space-y-2">
                  {['Notes','Terms & Conditions','Company Signature','Authorized By'].map(f => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={templateSettings[activeTemplateTab]?.[f]||false} onChange={e => setTemplateSettings({...templateSettings,[activeTemplateTab]:{...templateSettings[activeTemplateTab],[f]:e.target.checked}})} className="rounded border-gray-300" />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customer Program Tab */}
        {activeTab === 'program' && (
          <div className="max-w-6xl">
            <div className="bg-white rounded-lg shadow p-6">
              {/* Enable toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loyaltyEnabled}
                  onChange={e => setLoyaltyEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-green-500"
                />
                <span className="text-sm text-gray-700">Enable <span className="font-semibold">Customer Loyalty Program</span></span>
              </label>

              {loyaltyEnabled && (
                <div className="mt-6 space-y-6">
                  {/* Row 1: Earn & Redeem amounts */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className={labelCls}>
                        1 point will be earned on sale of <span className="text-red-500">*</span>
                      </label>
                      <div className="flex">
                        <input
                          type="number"
                          min="0"
                          placeholder=""
                          value={loyaltyEarnAmount}
                          onChange={e => { setLoyaltyEarnAmount(e.target.value); setLoyaltyErrors(er => ({ ...er, earn: '' })); }}
                          className={`flex-1 border rounded-l px-3 py-2 text-sm focus:outline-none focus:border-green-500 ${loyaltyErrors.earn ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        <span className="border border-l-0 border-gray-300 rounded-r px-3 py-2 text-sm bg-gray-50 text-gray-600 flex items-center">PKR</span>
                      </div>
                      {loyaltyErrors.earn && <p className="text-xs text-red-500 mt-1">{loyaltyErrors.earn}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>
                        On redemption, 1 point will give customer a discount equals to <span className="text-red-500">*</span>
                      </label>
                      <div className="flex">
                        <input
                          type="number"
                          min="0"
                          placeholder=""
                          value={loyaltyRedeemAmount}
                          onChange={e => { setLoyaltyRedeemAmount(e.target.value); setLoyaltyErrors(er => ({ ...er, redeem: '' })); }}
                          className={`flex-1 border rounded-l px-3 py-2 text-sm focus:outline-none focus:border-green-500 ${loyaltyErrors.redeem ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        <span className="border border-l-0 border-gray-300 rounded-r px-3 py-2 text-sm bg-gray-50 text-gray-600 flex items-center">PKR</span>
                      </div>
                      {loyaltyErrors.redeem && <p className="text-xs text-red-500 mt-1">{loyaltyErrors.redeem}</p>}
                    </div>
                  </div>

                  {/* Row 2: Expense Account & Customer Categories */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className={labelCls}>
                        Expense Account <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type to search account"
                          value={loyaltyExpenseAccount}
                          onChange={e => { setLoyaltyExpenseAccount(e.target.value); setLoyaltyErrors(er => ({ ...er, expenseAccount: '' })); }}
                          className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 pr-8 ${loyaltyErrors.expenseAccount ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {loyaltyErrors.expenseAccount && <p className="text-xs text-red-500 mt-1">{loyaltyErrors.expenseAccount}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>Customer Categories</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type to search Category"
                          value={loyaltyCustomerCategories}
                          onChange={e => setLoyaltyCustomerCategories(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 pr-8"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Customer Loyalty Calculation */}
                  <div>
                    <div className="flex items-center gap-8">
                      <span className="text-sm text-gray-700">Customer Loyalty Calculation</span>
                      <div className="flex items-center gap-6">
                        {(['ceiling', 'floor', 'round'] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <div
                              onClick={() => setLoyaltyCalculation(opt)}
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                                loyaltyCalculation === opt ? 'border-green-500' : 'border-gray-400'
                              }`}
                            >
                              {loyaltyCalculation === opt && (
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                              )}
                            </div>
                            <span className="text-sm text-gray-700 capitalize">{opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Info box */}
                    <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded text-sm text-gray-700">
                      {loyaltyCalculation === 'ceiling' && (
                        <>Ceiling to round up to the nearest integer example: 182.2 = 183 and 182.7 = 183</>
                      )}
                      {loyaltyCalculation === 'floor' && (
                        <>Floor to round down to the nearest integer example: 182.2 = 182 and 182.7 = 182</>
                      )}
                      {loyaltyCalculation === 'round' && (
                        <>Round to round to the nearest integer example: 182.2 = 182 and 182.7 = 183</>
                      )}
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSave}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded font-semibold text-sm transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                      SAVE
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-4 bg-white flex gap-2 justify-end">
        <button
          onClick={handleSave}
          className="bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm font-semibold px-6 py-2 rounded transition-colors cursor-pointer"
        >
          SAVE
        </button>
      </div>

      {/* Toast Notification - Display on all tabs */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg text-white font-semibold flex items-center gap-2 z-40 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.type === 'success' && (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
