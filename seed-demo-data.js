/**
 * TechZone Electronics — Demo Data Seeder
 * =========================================
 * Business niche: IT Equipment & Electronics Retail (Pakistan)
 *
 * HOW TO USE:
 *   1. Open the app in your browser (http://localhost:5173)
 *   2. Log in with admin / 123456
 *   3. Create a business (e.g. "TechZone Electronics") and enter it
 *   4. Open browser DevTools → Console (F12)
 *   5. Paste this entire file contents into the console and press Enter
 *   6. Wait for "🎉 Seeding complete!" — takes ~2-3 minutes
 *
 * The script uses your active login token + active business ID automatically.
 */

(async function seedTechZone() {
  'use strict';

  // ── Auth + Company context ─────────────────────────────────────────────────
  const token = localStorage.getItem('evotrade_token');
  const biz   = JSON.parse(localStorage.getItem('evotrade_active_business') || '{}');
  const companyId = biz.id || 'evotrade';

  if (!token) {
    console.error('❌  Not logged in. Please log in first, select a business, then re-run.');
    return;
  }
  console.log(`🚀  Seeding TechZone Electronics into company: "${biz.name || companyId}"`);
  console.log('    This will take 2–3 minutes. Do not close the tab.\n');

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const res = await fetch('/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Company-ID': companyId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`${method} ${path} → ${res.status}: ${e.error || 'unknown error'}`);
    }
    return res.json();
  }
  const post = (path, body) => api('POST', path, body);
  const get  = (path)       => api('GET',  path);

  async function createAll(label, endpoint, items) {
    console.log(`  ↳ ${label}…`);
    const results = [];
    for (const item of items) {
      try { results.push(await post(endpoint, item)); }
      catch (e) { console.warn(`    ⚠️  ${label}: ${e.message}`); }
    }
    console.log(`  ✅  ${results.length}/${items.length} ${label} created`);
    return results;
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const today = () => new Date().toISOString().slice(0, 10);
  const daysFromNow = (n) => {
    const d = new Date(); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const daysAgo = (n) => daysFromNow(-n);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Master Lists (no dependencies)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n📂  Section 1: Master Lists');

  // 1a. Customer Categories
  const custCats = await createAll('Customer Categories', '/customer-categories', [
    { name: 'Corporate Clients' },
    { name: 'Retail Customers' },
    { name: 'Educational Institutions' },
    { name: 'Government Agencies' },
    { name: 'Healthcare Organizations' },
    { name: 'SMB Clients' },
    { name: 'Enterprise Accounts' },
    { name: 'Resellers & Distributors' },
    { name: 'Online Buyers' },
    { name: 'Export Clients' },
  ]);

  // 1b. Vendor Categories
  const vendCats = await createAll('Vendor Categories', '/vendor-categories', [
    { name: 'Authorized Importers' },
    { name: 'Distributors' },
    { name: 'Local Suppliers' },
    { name: 'Service Providers' },
    { name: 'Logistics Partners' },
    { name: 'OEM Manufacturers' },
    { name: 'Component Suppliers' },
    { name: 'Software Vendors' },
  ]);

  // 1c. Product Categories
  const prodCats = await createAll('Product Categories', '/product-categories', [
    { name: 'Laptops & Notebooks' },
    { name: 'Desktop Computers' },
    { name: 'Mobile Phones' },
    { name: 'Computer Accessories' },
    { name: 'Networking Equipment' },
    { name: 'Printers & Scanners' },
    { name: 'Storage Devices' },
    { name: 'Computer Components' },
    { name: 'Tablets & iPads' },
    { name: 'Gaming Peripherals' },
    { name: 'Monitors & Displays' },
    { name: 'UPS & Power Equipment' },
  ]);

  // 1d. Brands
  const brands = await createAll('Brands', '/brands', [
    { name: 'Apple' },
    { name: 'Samsung' },
    { name: 'HP' },
    { name: 'Dell' },
    { name: 'Lenovo' },
    { name: 'Sony' },
    { name: 'LG' },
    { name: 'Asus' },
    { name: 'Acer' },
    { name: 'Toshiba' },
    { name: 'Canon' },
    { name: 'Epson' },
    { name: 'D-Link' },
    { name: 'TP-Link' },
    { name: 'Western Digital' },
    { name: 'Seagate' },
    { name: 'Kingston' },
    { name: 'Corsair' },
    { name: 'Logitech' },
    { name: 'Microsoft' },
    { name: 'APC' },
    { name: 'Hikvision' },
  ]);

  // 1e. Taxes
  const taxes = await createAll('Taxes', '/taxes', [
    { name: 'GST 17%',            percent: 17, type: 'percentage' },
    { name: 'Reduced Rate 5%',    percent: 5,  type: 'percentage' },
    { name: 'Zero Rated 0%',      percent: 0,  type: 'percentage' },
    { name: 'Import Duty 10%',    percent: 10, type: 'percentage' },
    { name: 'WHT 2%',             percent: 2,  type: 'percentage' },
    { name: 'Additional ST 3%',   percent: 3,  type: 'percentage' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — HR Setup
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n👥  Section 2: HR Setup');

  const departments = await createAll('Departments', '/departments', [
    { name: 'Sales & Marketing' },
    { name: 'Information Technology' },
    { name: 'Human Resources' },
    { name: 'Finance & Accounts' },
    { name: 'Operations' },
    { name: 'Warehouse & Logistics' },
    { name: 'Customer Support' },
    { name: 'Procurement' },
    { name: 'Administration' },
  ]);

  const designations = await createAll('Designations', '/designations', [
    { name: 'Chief Executive Officer' },
    { name: 'General Manager' },
    { name: 'Department Manager' },
    { name: 'Senior Sales Executive' },
    { name: 'Sales Executive' },
    { name: 'IT Engineer' },
    { name: 'HR Officer' },
    { name: 'Accounts Officer' },
    { name: 'Warehouse Supervisor' },
    { name: 'Customer Service Representative' },
    { name: 'Procurement Officer' },
    { name: 'Marketing Specialist' },
    { name: 'System Administrator' },
    { name: 'Accountant' },
  ]);

  const employees = await createAll('Employees', '/employees', [
    { name: 'Ali Hassan Malik',    phone: '0300-1111111', email: 'ali.malik@techzone.pk',     salary: 250000, cnic: '42101-1234567-1', join_date: '2020-01-05' },
    { name: 'Fatima Zahra Khan',   phone: '0321-2222222', email: 'fatima.khan@techzone.pk',   salary: 180000, cnic: '42201-2345678-2', join_date: '2020-03-15' },
    { name: 'Muhammad Usman',      phone: '0333-3333333', email: 'm.usman@techzone.pk',       salary: 120000, cnic: '35201-3456789-3', join_date: '2020-06-01' },
    { name: 'Sara Ahmed',          phone: '0345-4444444', email: 'sara.ahmed@techzone.pk',    salary: 95000,  cnic: '35202-4567890-4', join_date: '2021-01-10' },
    { name: 'Bilal Raza',          phone: '0311-5555555', email: 'bilal.raza@techzone.pk',    salary: 110000, cnic: '42301-5678901-5', join_date: '2021-02-20' },
    { name: 'Ayesha Tariq',        phone: '0322-6666666', email: 'ayesha.tariq@techzone.pk',  salary: 85000,  cnic: '42401-6789012-6', join_date: '2021-04-01' },
    { name: 'Kamran Sheikh',       phone: '0344-7777777', email: 'kamran.sheikh@techzone.pk', salary: 130000, cnic: '42501-7890123-7', join_date: '2021-05-15' },
    { name: 'Nadia Iqbal',         phone: '0315-8888888', email: 'nadia.iqbal@techzone.pk',   salary: 75000,  cnic: '42601-8901234-8', join_date: '2021-07-01' },
    { name: 'Tariq Mehmood',       phone: '0301-9999999', email: 'tariq.mehmood@techzone.pk', salary: 145000, cnic: '42701-9012345-9', join_date: '2021-09-10' },
    { name: 'Zainab Hussain',      phone: '0340-1234560', email: 'zainab.hussain@techzone.pk',salary: 90000,  cnic: '42801-0123456-0', join_date: '2021-11-01' },
    { name: 'Omar Farooq',         phone: '0300-2233445', email: 'omar.farooq@techzone.pk',   salary: 165000, cnic: '42101-1234568-1', join_date: '2022-01-15' },
    { name: 'Sana Butt',           phone: '0321-3344556', email: 'sana.butt@techzone.pk',     salary: 70000,  cnic: '42201-2345679-2', join_date: '2022-03-01' },
    { name: 'Hassan Ali',          phone: '0333-4455667', email: 'hassan.ali@techzone.pk',    salary: 105000, cnic: '35201-3456780-3', join_date: '2022-04-20' },
    { name: 'Maria Javed',         phone: '0345-5566778', email: 'maria.javed@techzone.pk',   salary: 88000,  cnic: '35202-4567891-4', join_date: '2022-06-01' },
    { name: 'Adnan Qureshi',       phone: '0311-6677889', email: 'adnan.qureshi@techzone.pk', salary: 125000, cnic: '42301-5678902-5', join_date: '2022-08-10' },
    { name: 'Rabia Nadeem',        phone: '0322-7788990', email: 'rabia.nadeem@techzone.pk',  salary: 78000,  cnic: '42401-6789013-6', join_date: '2022-10-01' },
    { name: 'Faisal Sultan',       phone: '0344-8899001', email: 'faisal.sultan@techzone.pk', salary: 195000, cnic: '42501-7890124-7', join_date: '2023-01-05' },
    { name: 'Hina Baig',           phone: '0315-9900112', email: 'hina.baig@techzone.pk',     salary: 65000,  cnic: '42601-8901235-8', join_date: '2023-03-15' },
    { name: 'Waseem Akhtar',       phone: '0301-0011223', email: 'waseem.akhtar@techzone.pk', salary: 115000, cnic: '42701-9012346-9', join_date: '2023-05-01' },
    { name: 'Saima Perveen',       phone: '0340-1122334', email: 'saima.perveen@techzone.pk', salary: 82000,  cnic: '42801-0123457-0', join_date: '2023-07-10' },
  ].map(e => ({
    ...e,
    department_id:  pick(departments)?.id || null,
    designation_id: pick(designations)?.id || null,
    is_active: true,
  })));

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Customers & Vendors
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n🤝  Section 3: Customers & Vendors');

  const customers = await createAll('Customers', '/customers', [
    { print_name: 'Techno Solutions Pvt Ltd',   email_1: 'info@technosol.pk',      phone_1: '0300-1234567', city: 'Karachi',    country: 'Pakistan', credit_limit: 500000,  opening_balance: 0 },
    { print_name: 'Digital World Trading',       email_1: 'sales@digitalworld.pk',  phone_1: '0321-2345678', city: 'Lahore',     country: 'Pakistan', credit_limit: 300000,  opening_balance: 0 },
    { print_name: 'Smart Systems Corp',          email_1: 'contact@smartsys.pk',    phone_1: '0333-3456789', city: 'Islamabad',  country: 'Pakistan', credit_limit: 750000,  opening_balance: 25000 },
    { print_name: 'City College of Technology',  email_1: 'admin@cct.edu.pk',       phone_1: '042-45678901', city: 'Lahore',     country: 'Pakistan', credit_limit: 200000,  opening_balance: 0 },
    { print_name: 'National Hospital IT Dept',   email_1: 'it@nathospital.pk',      phone_1: '021-34567890', city: 'Karachi',    country: 'Pakistan', credit_limit: 400000,  opening_balance: 50000 },
    { print_name: 'Ahmed & Sons Electronics',    email_1: 'ahmed@aselec.pk',        phone_1: '0345-4567890', city: 'Faisalabad', country: 'Pakistan', credit_limit: 150000,  opening_balance: 0 },
    { print_name: 'MegaMart Retail Chain',       email_1: 'proc@megamart.pk',       phone_1: '051-5678901', city: 'Rawalpindi', country: 'Pakistan', credit_limit: 1000000, opening_balance: 120000 },
    { print_name: 'InfoTech Solutions LLC',      email_1: 'info@infotech.pk',       phone_1: '0311-6789012', city: 'Karachi',    country: 'Pakistan', credit_limit: 250000,  opening_balance: 0 },
    { print_name: 'Raza Computer Centre',        email_1: 'raza@razacomp.pk',       phone_1: '0322-7890123', city: 'Multan',     country: 'Pakistan', credit_limit: 100000,  opening_balance: 0 },
    { print_name: 'Federal Government Stores',   email_1: 'purchase@fgs.gov.pk',    phone_1: '051-9012345', city: 'Islamabad',  country: 'Pakistan', credit_limit: 2000000, opening_balance: 300000 },
    { print_name: 'Hassan Traders',              email_1: 'hassan@hassantrade.pk',  phone_1: '0344-0123456', city: 'Hyderabad',  country: 'Pakistan', credit_limit: 80000,   opening_balance: 0 },
    { print_name: 'TechBridge Enterprise',       email_1: 'info@techbridge.pk',     phone_1: '0300-9876543', city: 'Karachi',    country: 'Pakistan', credit_limit: 600000,  opening_balance: 75000 },
    { print_name: 'Punjab University IT Dept',   email_1: 'it@pu.edu.pk',           phone_1: '042-35761944', city: 'Lahore',     country: 'Pakistan', credit_limit: 500000,  opening_balance: 0 },
    { print_name: 'Malik Electronics Store',     email_1: 'malik@malikelectro.pk',  phone_1: '0333-1122334', city: 'Sialkot',    country: 'Pakistan', credit_limit: 120000,  opening_balance: 0 },
    { print_name: 'NextGen Networks',            email_1: 'sales@nextgennet.pk',    phone_1: '021-32456789', city: 'Karachi',    country: 'Pakistan', credit_limit: 350000,  opening_balance: 0 },
    { print_name: 'Al-Farooq Trading Co',        email_1: 'alfarooq@altrade.pk',    phone_1: '0315-5544332', city: 'Peshawar',   country: 'Pakistan', credit_limit: 180000,  opening_balance: 0 },
    { print_name: 'GreenTech Innovation Hub',    email_1: 'hello@greentech.pk',     phone_1: '0323-6677889', city: 'Islamabad',  country: 'Pakistan', credit_limit: 400000,  opening_balance: 0 },
    { print_name: 'ZaibTech Computers',          email_1: 'zaib@zaibtech.pk',       phone_1: '0301-9988776', city: 'Lahore',     country: 'Pakistan', credit_limit: 220000,  opening_balance: 15000 },
    { print_name: 'Star Global Exports',         email_1: 'export@starglobal.pk',   phone_1: '021-35890123', city: 'Karachi',    country: 'Pakistan', credit_limit: 900000,  opening_balance: 0 },
    { print_name: 'Pak IT Solutions',            email_1: 'info@pakitsol.pk',       phone_1: '0340-2233445', city: 'Quetta',     country: 'Pakistan', credit_limit: 150000,  opening_balance: 0 },
    { print_name: 'NetConnect Pvt Ltd',          email_1: 'net@netconnect.pk',      phone_1: '021-32111222', city: 'Karachi',    country: 'Pakistan', credit_limit: 275000,  opening_balance: 0 },
    { print_name: 'Vision Tech Academy',         email_1: 'vision@vtacademy.pk',    phone_1: '042-36111333', city: 'Lahore',     country: 'Pakistan', credit_limit: 120000,  opening_balance: 0 },
  ].map(c => ({ ...c, category_id: pick(custCats)?.id || null })));

  const vendors = await createAll('Vendors', '/vendors', [
    { print_name: 'Al-Haj Imports',             email: 'import@alhaj.pk',         phone_1: '021-34789012', address: 'Phase II SITE, Karachi' },
    { print_name: 'Tech Galaxy Distribution',   email: 'sales@techgalaxy.pk',     phone_1: '042-35612345', address: 'Hafeez Centre, Lahore' },
    { print_name: 'Digital Hub Wholesale',      email: 'info@digitalhub.pk',      phone_1: '051-2654321',  address: 'Blue Area, Islamabad' },
    { print_name: 'Crescent Technology',        email: 'ctt@crescent.pk',         phone_1: '0300-8001234', address: 'Saddar, Karachi' },
    { print_name: 'Prime IT Distributors',      email: 'sales@primeIT.pk',        phone_1: '042-37231001', address: 'Gulberg III, Lahore' },
    { print_name: 'HP Authorized Partner Pak',  email: 'hp@hppak.pk',             phone_1: '021-35380000', address: 'I.I. Chundrigar, Karachi' },
    { print_name: 'Dell Enterprise Solutions',  email: 'dell@dellpk.pk',          phone_1: '042-38500100', address: 'DHA Phase V, Lahore' },
    { print_name: 'Lenovo Distributor Pak',     email: 'lenovo@lenovopk.pk',      phone_1: '021-32454000', address: 'Clifton, Karachi' },
    { print_name: 'Samsung Official Partner',   email: 'samsung@samspk.pk',       phone_1: '051-2802100',  address: 'F-10 Markaz, Islamabad' },
    { print_name: 'Apple Authorized Reseller',  email: 'apple@applestore.pk',     phone_1: '021-35611234', address: 'Dolmen Mall, Karachi' },
    { print_name: 'Network Components Ltd',     email: 'info@netcomp.pk',         phone_1: '042-36001234', address: 'Model Town, Lahore' },
    { print_name: 'Storage Solutions PK',       email: 'storage@sspk.pk',         phone_1: '021-34509876', address: 'PECHS, Karachi' },
    { print_name: 'Canon & Epson Importers',    email: 'printers@cepak.pk',       phone_1: '051-4865321',  address: 'G-9 Markaz, Islamabad' },
    { print_name: 'Gaming Zone Wholesale',      email: 'games@gzwholesale.pk',    phone_1: '0321-4567890', address: 'Gulshan-e-Iqbal, Karachi' },
    { print_name: 'Accessories World',          email: 'acc@accworld.pk',          phone_1: '042-35211000', address: 'Liberty Market, Lahore' },
    { print_name: 'Wireless Tech Partners',     email: 'wireless@wtp.pk',         phone_1: '021-36400000', address: 'North Nazimabad, Karachi' },
    { print_name: 'Micro Electronics Import',   email: 'micro@mei.pk',            phone_1: '051-2876543',  address: 'G-8 Markaz, Islamabad' },
    { print_name: 'Power Systems Pak',          email: 'ups@powersystems.pk',     phone_1: '0300-2100000', address: 'Faisalabad Road, Lahore' },
    { print_name: 'ZTech Global Supplies',      email: 'ztech@ztechglobal.pk',    phone_1: '021-37000123', address: 'Korangi, Karachi' },
    { print_name: 'Horizon IT Solutions',       email: 'horizon@horizonIT.pk',    phone_1: '042-36512345', address: 'Johar Town, Lahore' },
    { print_name: 'Apex Components Co',         email: 'apex@apexcomp.pk',        phone_1: '051-2345678',  address: 'Rawalpindi' },
    { print_name: 'Bright Future Electronics',  email: 'bfe@bfelectro.pk',        phone_1: '021-33445566', address: 'Korangi Industrial, Karachi' },
  ].map(v => ({ ...v, category_id: pick(vendCats)?.id || null })));

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Products
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n📦  Section 4: Products');

  const products = await createAll('Products', '/products', [
    { name: 'Apple MacBook Pro 16" M3 Pro',        type: 'product', sale_price: 649000,  purchase_price: 580000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Dell XPS 15 Laptop Core i7 13th Gen', type: 'product', sale_price: 279000,  purchase_price: 238000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'HP EliteBook 840 G10 Business',       type: 'product', sale_price: 219000,  purchase_price: 188000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Lenovo ThinkPad X1 Carbon Gen 11',   type: 'product', sale_price: 309000,  purchase_price: 269000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Asus ROG Strix G16 Gaming Laptop',   type: 'product', sale_price: 329000,  purchase_price: 285000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Samsung Galaxy S24 Ultra 256GB',      type: 'product', sale_price: 185000,  purchase_price: 160000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Apple iPhone 15 Pro Max 256GB',       type: 'product', sale_price: 370000,  purchase_price: 328000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Dell OptiPlex 7010 Desktop SFF',      type: 'product', sale_price: 95000,   purchase_price: 80000,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'HP Z4 G5 Workstation Core i9',        type: 'product', sale_price: 520000,  purchase_price: 455000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Apple iPad Pro 12.9" M2 WiFi 256GB', type: 'product', sale_price: 290000,  purchase_price: 252000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Samsung 27" 4K UHD IPS Monitor',     type: 'product', sale_price: 74500,   purchase_price: 63000,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'HP LaserJet Pro M404dn Printer',      type: 'product', sale_price: 54500,   purchase_price: 46000,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Canon PIXMA G3470 InkTank Printer',   type: 'product', sale_price: 31500,   purchase_price: 26500,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'TP-Link Archer AX73 WiFi 6 Router',  type: 'product', sale_price: 18500,   purchase_price: 15200,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'D-Link 24-Port Gigabit Switch',       type: 'product', sale_price: 27500,   purchase_price: 22800,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Western Digital 4TB Desktop HDD',     type: 'product', sale_price: 19500,   purchase_price: 16200,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Samsung 1TB 980 Pro NVMe SSD',        type: 'product', sale_price: 22000,   purchase_price: 18500,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Kingston 16GB DDR5 5200MHz RAM',      type: 'product', sale_price: 8500,    purchase_price: 7100,    unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Logitech MX Master 3S Mouse',         type: 'product', sale_price: 9500,    purchase_price: 7800,    unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Corsair K100 RGB Optical Keyboard',   type: 'product', sale_price: 28000,   purchase_price: 23500,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'APC 1500VA UPS Smart-UPS',            type: 'product', sale_price: 32000,   purchase_price: 26500,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'HP Poly Studio X50 Video Bar',        type: 'product', sale_price: 185000,  purchase_price: 160000,  unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'Hikvision 8-Channel NVR System',      type: 'product', sale_price: 45000,   purchase_price: 37500,   unit_of_measurement: 'PCS', is_sold: true, is_purchased: true,  track_inventory: true },
    { name: 'IT Support Services (per hour)',       type: 'service', sale_price: 5000,    purchase_price: 0,       unit_of_measurement: 'HRS', is_sold: true, is_purchased: false, track_inventory: false },
    { name: 'Annual Maintenance Contract',          type: 'service', sale_price: 25000,   purchase_price: 0,       unit_of_measurement: 'PCS', is_sold: true, is_purchased: false, track_inventory: false },
  ].map(p => ({
    ...p,
    category_id: pick(prodCats)?.id || null,
    brand_id:    pick(brands)?.id   || null,
  })));

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — Sales Persons & Other Contacts
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n💼  Section 5: Sales Persons & Contacts');

  await createAll('Sales Persons', '/sales-persons', [
    { print_name: 'Zubair Ahmed',     phone: '0300-1010101', email: 'zubair@techzone.pk',   type: 'salesman', can_add_discount: true },
    { print_name: 'Amna Khalid',      phone: '0321-2020202', email: 'amna@techzone.pk',     type: 'salesman', can_add_discount: false },
    { print_name: 'Shahzad Mirza',    phone: '0333-3030303', email: 'shahzad@techzone.pk',  type: 'salesman', can_add_discount: true },
    { print_name: 'Lubna Malik',      phone: '0345-4040404', email: 'lubna@techzone.pk',    type: 'salesman', can_add_discount: false },
    { print_name: 'Aamir Siddiqui',   phone: '0311-5050505', email: 'aamir@techzone.pk',    type: 'salesman', can_add_discount: true },
    { print_name: 'Qasim Hassan',     phone: '0322-6060606', email: 'qasim@techzone.pk',    type: 'salesman', can_add_discount: true },
    { print_name: 'Sadia Rizvi',      phone: '0344-7070707', email: 'sadia@techzone.pk',    type: 'salesman', can_add_discount: false },
    { print_name: 'Imran Baig',       phone: '0315-8080808', email: 'imran@techzone.pk',    type: 'salesman', can_add_discount: true },
    { print_name: 'Kiran Afzal',      phone: '0301-9090909', email: 'kiran@techzone.pk',    type: 'salesman', can_add_discount: false },
    { print_name: 'Naeem Chaudhry',   phone: '0340-1212121', email: 'naeem@techzone.pk',    type: 'salesman', can_add_discount: true },
    { print_name: 'Uzma Rehman',      phone: '0300-2323232', email: 'uzma@techzone.pk',     type: 'salesman', can_add_discount: false },
    { print_name: 'Tariq Gill',       phone: '0321-3434343', email: 'tariq.g@techzone.pk',  type: 'salesman', can_add_discount: true },
    { print_name: 'Aroha Shafiq',     phone: '0333-4545454', email: 'aroha@techzone.pk',    type: 'salesman', can_add_discount: false },
    { print_name: 'Danish Aslam',     phone: '0345-5656565', email: 'danish@techzone.pk',   type: 'salesman', can_add_discount: true },
    { print_name: 'Mehwish Noor',     phone: '0311-6767676', email: 'mehwish@techzone.pk',  type: 'salesman', can_add_discount: false },
    { print_name: 'Umar Sajid',       phone: '0322-7878787', email: 'umar@techzone.pk',     type: 'salesman', can_add_discount: true },
    { print_name: 'Fariha Zaidi',     phone: '0344-8989898', email: 'fariha@techzone.pk',   type: 'salesman', can_add_discount: false },
    { print_name: 'Saad Farhan',      phone: '0315-9090901', email: 'saad.f@techzone.pk',   type: 'salesman', can_add_discount: true },
    { print_name: 'Humaira Ghani',    phone: '0301-0101010', email: 'humaira@techzone.pk',  type: 'salesman', can_add_discount: false },
    { print_name: 'Junaid Akram',     phone: '0340-1212120', email: 'junaid@techzone.pk',   type: 'salesman', can_add_discount: true },
  ]);

  await createAll('Other Contacts', '/other-contacts', [
    { print_name: 'Allied Bank Ltd',           category: 'Bank',            contact_person: 'Relationship Manager', phone: '021-35650000', email: 'corp@abl.com.pk',        address: 'I.I. Chundrigar, Karachi' },
    { print_name: 'PTCL Business Center',      category: 'Telecom',         contact_person: 'Account Manager',      phone: '021-111-111-789', email: 'biz@ptcl.net.pk',     address: 'Shahrah-e-Faisal, Karachi' },
    { print_name: 'FedEx Pakistan',            category: 'Courier',         contact_person: 'Operations Head',      phone: '021-35862290',  email: 'pk@fedex.com',           address: 'Korangi, Karachi' },
    { print_name: 'TCS Couriers',              category: 'Courier',         contact_person: 'Tariq Hussain',        phone: '021-111-123-456', email: 'corporate@tcs.com.pk', address: 'Stadium Road, Karachi' },
    { print_name: 'KESC / K-Electric',         category: 'Utility',         contact_person: 'Commercial Dept',      phone: '021-99000',      email: 'commercial@ke.com.pk',   address: 'Ballard Pier, Karachi' },
    { print_name: 'Sui Southern Gas Co',       category: 'Utility',         contact_person: 'Billing Dept',         phone: '021-111-786-786', email: 'billing@ssgc.com.pk',  address: 'Dr. Ziauddin Ahmed, Karachi' },
    { print_name: 'MCB Bank Ltd',              category: 'Bank',            contact_person: 'Corporate Banking',    phone: '021-35635635',  email: 'corp@mcb.com.pk',        address: 'Main Branch, Karachi' },
    { print_name: 'Telenor Pakistan',          category: 'Telecom',         contact_person: 'Business Solutions',   phone: '0345-1111111',  email: 'bizcare@telenor.com.pk', address: 'Sector F-7, Islamabad' },
    { print_name: 'EFU Insurance',             category: 'Insurance',       contact_person: 'Corporate Sales',      phone: '021-35682340',  email: 'corp@efu.com.pk',        address: 'Chundrigar Road, Karachi' },
    { print_name: 'WAPDA Lahore Electric',     category: 'Utility',         contact_person: 'Admin Officer',        phone: '042-99201234', email: 'admin@lesco.gov.pk',      address: 'Gulberg, Lahore' },
    { print_name: 'Habib Bank Limited',        category: 'Bank',            contact_person: 'Branch Manager',       phone: '021-32441234', email: 'hbl@hbl.com',             address: 'Clifton Branch, Karachi' },
    { print_name: 'Jazz (Mobilink) Business',  category: 'Telecom',         contact_person: 'Enterprise Accounts',  phone: '0301-2345678', email: 'enterprise@jazz.com.pk',  address: 'G-8/4, Islamabad' },
    { print_name: 'NLC Logistics',             category: 'Logistics',       contact_person: 'Cargo Manager',        phone: '051-9270001',  email: 'cargo@nlc.com.pk',        address: 'Rawalpindi' },
    { print_name: 'State Life Insurance',      category: 'Insurance',       contact_person: 'Group Policy Dept',    phone: '021-99100000', email: 'group@statelife.gov.pk',  address: 'Karachi' },
    { print_name: 'DHL Pakistan',              category: 'Courier',         contact_person: 'Corporate Manager',    phone: '0800-00345',   email: 'pk.corp@dhl.com',         address: 'Airport Road, Karachi' },
    { print_name: 'Jubilee Life Insurance',    category: 'Insurance',       contact_person: 'Corporate Head',       phone: '021-35662250', email: 'corp@jubileelife.com',    address: 'Clifton, Karachi' },
    { print_name: 'Ufone Business',            category: 'Telecom',         contact_person: 'Enterprise Sales',     phone: '111-333-100',  email: 'biz@ufone.com',           address: 'Blue Area, Islamabad' },
    { print_name: 'OGDCL Petroleum',           category: 'Vendor',          contact_person: 'Commercial Dept',      phone: '051-9201271',  email: 'commercial@ogdcl.com',    address: 'OGDCL House, Islamabad' },
    { print_name: 'Pakistan Post',             category: 'Courier',         contact_person: 'Corporate Division',   phone: '051-9215555',  email: 'post@pakpost.gov.pk',     address: 'G-9/4, Islamabad' },
    { print_name: 'Meezan Bank',               category: 'Bank',            contact_person: 'Business Banking',     phone: '021-38103500', email: 'biz@meezanbank.com',      address: 'Karachi' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Projects
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n📋  Section 6: Projects');

  await createAll('Projects', '/projects', [
    { name: 'City Hospital IT Upgrade',          start_date: '2024-01-15', end_date: '2024-06-30', budget: 2500000, status: 'active',    notes: '150 workstations, server room setup' },
    { name: 'PU Campus Network Deployment',      start_date: '2024-02-01', end_date: '2024-08-31', budget: 3800000, status: 'active',    notes: 'Fiber optic cabling + WiFi 6 APs' },
    { name: 'MegaMart POS System Rollout',       start_date: '2024-03-10', end_date: '2024-07-31', budget: 1200000, status: 'active',    notes: '30 POS terminals across 5 branches' },
    { name: 'FGS Data Center Modernization',     start_date: '2023-09-01', end_date: '2024-03-31', budget: 8500000, status: 'completed', notes: 'Hyperconverged infrastructure' },
    { name: 'Smart Systems CCTV Installation',   start_date: '2024-04-01', end_date: '2024-05-30', budget: 450000,  status: 'active',    notes: '60-camera IP CCTV system' },
    { name: 'TechBridge Cloud Migration',        start_date: '2024-01-01', end_date: '2024-12-31', budget: 1800000, status: 'active',    notes: 'On-prem to Azure cloud migration' },
    { name: 'Annual AMC — Corporate Clients',    start_date: '2024-01-01', end_date: '2024-12-31', budget: 2200000, status: 'active',    notes: 'Maintenance for 8 corporate accounts' },
    { name: 'InfoTech Office Relocation IT',     start_date: '2024-05-01', end_date: '2024-06-15', budget: 380000,  status: 'active',    notes: 'Complete IT infra move + reconfiguration' },
    { name: 'Gaming Lab Setup — CCT',            start_date: '2024-03-01', end_date: '2024-04-30', budget: 2800000, status: 'completed', notes: '50 high-end gaming PCs + peripherals' },
    { name: 'ZaibTech Security Audit & Upgrade', start_date: '2024-02-15', end_date: '2024-03-31', budget: 550000,  status: 'completed', notes: 'Pen test + firewall + endpoint security' },
    { name: 'NextGen Networks Infrastructure',   start_date: '2024-06-01', end_date: '2024-11-30', budget: 4200000, status: 'active',    notes: 'ISP backbone equipment supply & install' },
    { name: 'Raza Computer Center Refurb',       start_date: '2023-12-01', end_date: '2024-01-31', budget: 180000,  status: 'completed', notes: 'Store renovation + display upgrade' },
    { name: 'Al-Farooq Export Documentation IT', start_date: '2024-04-15', end_date: '2024-05-31', budget: 320000,  status: 'active',    notes: 'Custom ERP integration project' },
    { name: 'GreenTech Smart Office Setup',      start_date: '2024-05-15', end_date: '2024-08-31', budget: 1500000, status: 'active',    notes: 'IoT-enabled smart office infrastructure' },
    { name: 'Star Global Export Tracking System',start_date: '2024-01-20', end_date: '2024-04-30', budget: 680000,  status: 'completed', notes: 'RFID + barcode warehouse tracking' },
    { name: 'Pak IT Training Lab',               start_date: '2024-03-01', end_date: '2024-04-15', budget: 950000,  status: 'completed', notes: '25-seat computer training center setup' },
    { name: 'NetConnect Fiber Backbone',         start_date: '2024-06-01', end_date: '2025-01-31', budget: 6500000, status: 'active',    notes: 'Metro fiber ring deployment' },
    { name: 'Hassan Traders Store Automation',   start_date: '2024-02-01', end_date: '2024-03-15', budget: 120000,  status: 'completed', notes: 'Billing + inventory software + hardware' },
    { name: 'Digital World VoIP Migration',      start_date: '2024-04-01', end_date: '2024-06-30', budget: 750000,  status: 'active',    notes: '100-seat IP PBX system' },
    { name: 'TechZone Showroom Upgrade',         start_date: '2024-07-01', end_date: '2024-09-30', budget: 2200000, status: 'active',    notes: 'Main branch display & demo units upgrade' },
  ].map(p => ({ ...p, customer_id: pick(customers)?.id || null })));

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 7 — Warehouses & Bank Accounts
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n🏪  Section 7: Warehouses & Bank Accounts');

  const warehouses = await createAll('Warehouses', '/warehouses', [
    { name: 'Main Warehouse — Karachi',      city: 'Karachi',    country: 'Pakistan', address_line1: 'Plot 45, SITE Area', contact_person: 'Imran Khan',   phone: '021-32561234', email: 'mainwh@techzone.pk' },
    { name: 'Lahore Distribution Center',   city: 'Lahore',     country: 'Pakistan', address_line1: 'Block C, Sundar', contact_person: 'Rizwan Ali',    phone: '042-35789012', email: 'lahore.wh@techzone.pk' },
    { name: 'Islamabad Showroom Store',     city: 'Islamabad',  country: 'Pakistan', address_line1: 'F-10 Markaz', contact_person: 'Sadaf Mehmood', phone: '051-2890123',  email: 'isb.wh@techzone.pk' },
    { name: 'Faisalabad Regional Hub',      city: 'Faisalabad', country: 'Pakistan', address_line1: 'D-Ground Area', contact_person: 'Ghulam Abbas',  phone: '041-8901234',  email: 'fsd.wh@techzone.pk' },
    { name: 'Karachi Airport Bonded',       city: 'Karachi',    country: 'Pakistan', address_line1: 'Export Processing Zone', contact_person: 'Asif Munir', phone: '021-34512345', email: 'air.wh@techzone.pk' },
    { name: 'Rawalpindi Service Center',    city: 'Rawalpindi', country: 'Pakistan', address_line1: 'Satellite Town', contact_person: 'Naveed Ahmed',  phone: '051-4512345',  email: 'rwp.svc@techzone.pk' },
  ]);

  const bankAccounts = await createAll('Bank Accounts', '/bank-accounts', [
    { code: 'BA-001', name: 'HBL Current Account — Main',     bank_name: 'Habib Bank Limited',         branch_name: 'Clifton Branch',      account_number: '12345678901234', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-002', name: 'MCB Business Account',           bank_name: 'Muslim Commercial Bank',     branch_name: 'I.I. Chundrigar',     account_number: '23456789012345', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-003', name: 'UBL Corporate Account',          bank_name: 'United Bank Limited',        branch_name: 'SITE Branch',         account_number: '34567890123456', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-004', name: 'Meezan Islamic Account',         bank_name: 'Meezan Bank Limited',        branch_name: 'Gulshan Branch',      account_number: '45678901234567', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-005', name: 'Petty Cash — Office',            bank_name: 'Cash',                       branch_name: 'Head Office',         account_number: 'CASH-001',       account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-006', name: 'Petty Cash — Warehouse',         bank_name: 'Cash',                       branch_name: 'Main Warehouse',      account_number: 'CASH-002',       account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-007', name: 'Allied Bank Lahore Account',     bank_name: 'Allied Bank Limited',        branch_name: 'Liberty Market',      account_number: '56789012345678', account_holder: 'TechZone Electronics', account_group: 'transactional' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 8 — Couriers
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n🚚  Section 8: Couriers');

  await createAll('Couriers', '/couriers', [
    { print_name: 'TCS Express',          courier_name: 'TCS Couriers',         phone: '111-123-456', email: 'corporate@tcs.com.pk',    city: 'Karachi',   country: 'Pakistan', tracking_url: 'https://www.tcs.com.pk/tracking/' },
    { print_name: 'Leopards Courier',     courier_name: 'Leopards Courier Svc', phone: '111-300-786', email: 'corp@leopardscourier.com', city: 'Lahore',    country: 'Pakistan', tracking_url: 'https://www.leopardscourier.com/' },
    { print_name: 'DHL Pakistan',         courier_name: 'DHL Express',           phone: '0800-00345',  email: 'pk.corp@dhl.com',         city: 'Karachi',   country: 'Pakistan', tracking_url: 'https://www.dhl.com/pk-en/home.html' },
    { print_name: 'FedEx Pakistan',       courier_name: 'FedEx Express',         phone: '021-35862290',email: 'pk@fedex.com',            city: 'Karachi',   country: 'Pakistan', tracking_url: 'https://www.fedex.com/en-pk/' },
    { print_name: 'M&P Logistics',        courier_name: 'M&P Express Logistics', phone: '111-006-111', email: 'corp@mnpexpress.com',     city: 'Lahore',    country: 'Pakistan', tracking_url: 'https://mnpexpress.com/' },
    { print_name: 'Swyft Delivery',       courier_name: 'Swyft Logistics',       phone: '0321-7787878',email: 'biz@swyftlogistics.pk',   city: 'Lahore',    country: 'Pakistan', tracking_url: 'https://swyftlogistics.com/' },
    { print_name: 'Pakistan Post Office', courier_name: 'Pakistan Post',         phone: '051-9215555', email: 'post@pakpost.gov.pk',     city: 'Islamabad', country: 'Pakistan', tracking_url: 'https://track.pakpost.gov.pk/' },
    { print_name: 'Trax Logistics',       courier_name: 'Trax',                  phone: '0311-1817290',email: 'corp@trax.pk',            city: 'Karachi',   country: 'Pakistan', tracking_url: 'https://app.trax.pk/' },
    { print_name: 'PostEx',               courier_name: 'PostEx Courier',         phone: '0317-4000311',email: 'biz@postex.pk',           city: 'Lahore',    country: 'Pakistan', tracking_url: 'https://postex.pk/' },
    { print_name: 'BlueEx',               courier_name: 'BlueEx Courier',         phone: '0315-2583583',email: 'corp@blueex.com',         city: 'Karachi',   country: 'Pakistan', tracking_url: 'https://blueex.com/' },
    { print_name: 'NLC Cargo',            courier_name: 'NLC Logistics',          phone: '051-9270001', email: 'cargo@nlc.com.pk',        city: 'Rawalpindi',country: 'Pakistan', tracking_url: 'https://nlc.com.pk/' },
    { print_name: 'Airblue Cargo',        courier_name: 'Airblue Air Cargo',      phone: '021-34578100',email: 'cargo@airblue.com',       city: 'Karachi',   country: 'Pakistan', tracking_url: 'https://www.airblue.com/' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 9 — CRM
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n🎯  Section 9: CRM Leads & Prospects');

  await createAll('CRM Leads', '/crm-leads', [
    { name: 'Ahsan Zafar',       company: 'Zafar Holdings',          email: 'ahsan@zafarholdings.pk', phone: '0300-9876543', source: 'Website',     stage: 'new',        probability: 20, expected_revenue: 850000,  industry: 'Retail',       notes: 'Interested in POS system for 10 outlets' },
    { name: 'Mehrunissa Alam',   company: 'Alam Education Group',    email: 'mehr@aeg.edu.pk',        phone: '0321-8765432', source: 'Referral',    stage: 'qualified',  probability: 60, expected_revenue: 2200000, industry: 'Education',    notes: '5 school branches need complete IT setup' },
    { name: 'Rizwan Shaheen',    company: 'Shaheen Pharma',          email: 'rizwan@shaheenpharma.pk',phone: '0333-7654321', source: 'Cold Call',   stage: 'new',        probability: 15, expected_revenue: 380000,  industry: 'Healthcare',   notes: 'Lab computers & medical printers' },
    { name: 'Naila Pervez',      company: 'Pervez Textile Mills',    email: 'naila@ptm.pk',           phone: '0345-6543210', source: 'Exhibition',  stage: 'qualified',  probability: 45, expected_revenue: 1200000, industry: 'Manufacturing',notes: 'Factory floor monitoring + ERP hardware' },
    { name: 'Salman Chaudhry',   company: 'Chaudhry Real Estate',    email: 'salman@cre.pk',          phone: '0311-5432109', source: 'Website',     stage: 'proposal',   probability: 75, expected_revenue: 550000,  industry: 'Real Estate',  notes: 'Smart office setup for new HQ' },
    { name: 'Humaira Siddiqui',  company: 'Siddiqui Law Associates', email: 'law@siddiqui.pk',        phone: '0322-4321098', source: 'LinkedIn',    stage: 'new',        probability: 25, expected_revenue: 180000,  industry: 'Legal',        notes: '15 workstations + NAS server' },
    { name: 'Babar Nawaz',       company: 'Nawaz Agro Industries',   email: 'babar@nagroind.pk',      phone: '0344-3210987', source: 'Trade Show',  stage: 'qualified',  probability: 35, expected_revenue: 320000,  industry: 'Agriculture',  notes: 'Field tracking tablets + rugged laptops' },
    { name: 'Shazia Tashfeen',   company: 'Tashfeen Media Group',    email: 'shazia@tmg.pk',          phone: '0315-2109876', source: 'Referral',    stage: 'proposal',   probability: 65, expected_revenue: 980000,  industry: 'Media',        notes: 'Video production workstations + storage' },
    { name: 'Pervaiz Elahi',     company: 'Elahi Construction Co',   email: 'pervaiz@ecc.pk',         phone: '0301-1098765', source: 'Cold Call',   stage: 'new',        probability: 10, expected_revenue: 450000,  industry: 'Construction', notes: 'Site office IT setup for 3 projects' },
    { name: 'Raheela Bashir',    company: 'Bashir Hospital Network', email: 'raheela@bhn.pk',         phone: '0340-0987654', source: 'Website',     stage: 'qualified',  probability: 55, expected_revenue: 3200000, industry: 'Healthcare',   notes: 'Hospital management system + hardware' },
    { name: 'Kamran Niaz',       company: 'Niaz Logistics Co',       email: 'kamran@nlco.pk',         phone: '0300-8765432', source: 'LinkedIn',    stage: 'negotiation',probability: 80, expected_revenue: 750000,  industry: 'Logistics',    notes: 'Fleet management + RFID tracking system' },
    { name: 'Samar Rasheed',     company: 'Rasheed Food Industries',  email: 'samar@rfi.pk',          phone: '0321-7654321', source: 'Referral',    stage: 'new',        probability: 20, expected_revenue: 280000,  industry: 'Food',         notes: 'Factory monitoring cameras + switches' },
    { name: 'Noman Karimi',      company: 'Karimi Import Export',    email: 'noman@kimportexport.pk', phone: '0333-6543210', source: 'Exhibition',  stage: 'proposal',   probability: 50, expected_revenue: 1650000, industry: 'Trading',      notes: 'Warehouse management + scanners' },
    { name: 'Amber Gilani',      company: 'Gilani Fashion House',    email: 'amber@gfh.pk',           phone: '0345-5432109', source: 'Walk-in',     stage: 'qualified',  probability: 40, expected_revenue: 220000,  industry: 'Retail',       notes: 'Showroom display screens + billing' },
    { name: 'Sohail Wasim',      company: 'Wasim Tours & Travels',   email: 'sohail@wtravels.pk',     phone: '0311-4321098', source: 'Social Media',stage: 'new',        probability: 15, expected_revenue: 150000,  industry: 'Tourism',      notes: 'Office IT + booking system terminals' },
    { name: 'Irfan Haider',      company: 'Haider Engineering Works',email: 'irfan@hengineering.pk', phone: '0322-3210987', source: 'Cold Call',   stage: 'proposal',   probability: 60, expected_revenue: 480000,  industry: 'Engineering',  notes: 'CAD workstations + plotter printer' },
    { name: 'Sumbul Naqvi',      company: 'Naqvi & Partners CPA',   email: 'sumbul@naqvicpa.pk',     phone: '0344-2109876', source: 'Referral',    stage: 'qualified',  probability: 45, expected_revenue: 310000,  industry: 'Finance',      notes: 'Accounting workstations + secure backup' },
    { name: 'Asif Jalal',        company: 'Jalal Auto Parts',        email: 'asif@jalalauto.pk',      phone: '0315-1098765', source: 'Walk-in',     stage: 'new',        probability: 25, expected_revenue: 195000,  industry: 'Automotive',   notes: 'POS + inventory management for 2 stores' },
    { name: 'Farrukh Ansari',    company: 'Ansari Steel Mills',      email: 'farrukh@asteel.pk',      phone: '0301-0987654', source: 'Trade Show',  stage: 'qualified',  probability: 35, expected_revenue: 560000,  industry: 'Manufacturing',notes: 'Industrial-grade computers + servers' },
    { name: 'Madiha Sayeed',     company: 'Sayeed Digital Marketing',email: 'madiha@sdm.pk',          phone: '0340-9876543', source: 'Social Media',stage: 'negotiation',probability: 70, expected_revenue: 420000,  industry: 'Marketing',    notes: 'Creative workstations + UPS + monitors' },
  ]);

  await createAll('Prospects', '/prospects', [
    { print_name: 'Rafiq Brothers',         contact_person: 'Muhammad Rafiq',  email: 'rafiq@rafiqbros.pk',      phone: '021-35001234', city: 'Karachi',    country: 'Pakistan', source: 'Exhibition',  status: 'active', industry: 'Retail',        notes: 'Interested in POS + inventory' },
    { print_name: 'Sunrise Technologies',   contact_person: 'Nasir Ahmed',     email: 'nasir@sunrisetec.pk',     phone: '042-36002345', city: 'Lahore',     country: 'Pakistan', source: 'Website',     status: 'active', industry: 'IT Services',   notes: '5 office branches IT setup' },
    { print_name: 'Crescent Developers',    contact_person: 'Bilal Crescent',  email: 'bilal@crescentdev.pk',    phone: '051-2803456',  city: 'Islamabad',  country: 'Pakistan', source: 'Referral',    status: 'active', industry: 'Real Estate',   notes: 'Smart office project' },
    { print_name: 'Al-Noor Enterprises',    contact_person: 'Noor Khalid',     email: 'noor@alnoor.pk',          phone: '0300-4004567', city: 'Karachi',    country: 'Pakistan', source: 'Cold Call',   status: 'active', industry: 'Trading',       notes: 'Workstations & printers' },
    { print_name: 'Pak Minerals Co',        contact_person: 'Zahid Khan',      email: 'zahid@pakminerals.pk',    phone: '0321-5005678', city: 'Quetta',     country: 'Pakistan', source: 'Trade Show',  status: 'active', industry: 'Mining',        notes: 'Rugged laptops + tablets' },
    { print_name: 'Delta Freight Services', contact_person: 'Usman Delta',     email: 'usman@deltafreight.pk',   phone: '021-36006789', city: 'Karachi',    country: 'Pakistan', source: 'LinkedIn',    status: 'active', industry: 'Logistics',     notes: 'Fleet tracking & RFID' },
    { print_name: 'Platinum Hotels Group',  contact_person: 'Adil Platinum',   email: 'adil@platinumhotels.pk',  phone: '051-2807890',  city: 'Islamabad',  country: 'Pakistan', source: 'Website',     status: 'active', industry: 'Hospitality',   notes: 'Hotel management systems' },
    { print_name: 'Green Valley Farms',     contact_person: 'Iqbal Farms',     email: 'iqbal@greenvalley.pk',    phone: '0345-8008901', city: 'Lahore',     country: 'Pakistan', source: 'Referral',    status: 'active', industry: 'Agriculture',   notes: 'Field monitoring tablets' },
    { print_name: 'Metro Healthcare',       contact_person: 'Dr. Sana Metro',  email: 'sana@metrohealthcare.pk', phone: '021-37009012', city: 'Karachi',    country: 'Pakistan', source: 'Exhibition',  status: 'active', industry: 'Healthcare',    notes: 'Hospital mgmt system' },
    { print_name: 'Crown Packaging',        contact_person: 'Atif Crown',      email: 'atif@crownpack.pk',       phone: '042-38010123', city: 'Lahore',     country: 'Pakistan', source: 'Cold Call',   status: 'active', industry: 'Manufacturing', notes: 'Factory floor computers' },
    { print_name: 'Pak Aviation Services',  contact_person: 'Asad Aviation',   email: 'asad@pakaviation.pk',     phone: '021-39011234', city: 'Karachi',    country: 'Pakistan', source: 'LinkedIn',    status: 'active', industry: 'Aviation',      notes: 'Aviation grade workstations' },
    { print_name: 'Horizon Schools',        contact_person: 'Sara Horizon',    email: 'sara@horizonschools.pk',  phone: '042-35012345', city: 'Lahore',     country: 'Pakistan', source: 'Walk-in',     status: 'active', industry: 'Education',     notes: 'Computer labs for 5 campuses' },
    { print_name: 'Sapphire Textiles',      contact_person: 'Faiz Sapphire',   email: 'faiz@sapphiretex.pk',     phone: '041-8013456',  city: 'Faisalabad', country: 'Pakistan', source: 'Trade Show',  status: 'active', industry: 'Textiles',      notes: 'ERP hardware + servers' },
    { print_name: 'National Foods Ltd',     contact_person: 'Haris National',  email: 'haris@natfoods.pk',       phone: '021-32014567', city: 'Karachi',    country: 'Pakistan', source: 'Website',     status: 'active', industry: 'Food',          notes: 'ERP workstations + NAS' },
    { print_name: 'Lahore Electric Supply', contact_person: 'Rizwan LESCO',    email: 'rizwan@lesco.gov.pk',     phone: '042-99015678', city: 'Lahore',     country: 'Pakistan', source: 'Government',  status: 'active', industry: 'Utilities',     notes: 'Substation monitoring systems' },
    { print_name: 'Fauji Fertilizers',      contact_person: 'Col. Ahmed',      email: 'ahmed@ffc.com.pk',        phone: '051-9016789',  city: 'Rawalpindi', country: 'Pakistan', source: 'Referral',    status: 'active', industry: 'Agriculture',   notes: 'Corporate IT procurement' },
    { print_name: 'City District Courts',   contact_person: 'Mukhtar Courts',  email: 'it@courts.gov.pk',        phone: '042-99017890', city: 'Lahore',     country: 'Pakistan', source: 'Government',  status: 'active', industry: 'Government',    notes: 'Court digitization project' },
    { print_name: 'Q Mobile Distribution',  contact_person: 'Ali Q',           email: 'ali@qmobile.pk',          phone: '021-36018901', city: 'Karachi',    country: 'Pakistan', source: 'Exhibition',  status: 'active', industry: 'Telecom',       notes: 'POS terminals for retail chain' },
    { print_name: 'Qadir Bux Telecom',      contact_person: 'Qadir Bux',       email: 'qadir@qbtelecom.pk',      phone: '0315-9019012', city: 'Hyderabad',  country: 'Pakistan', source: 'Walk-in',     status: 'active', industry: 'Telecom',       notes: 'Internet service provider gear' },
    { print_name: 'Sindh Revenue Authority',contact_person: 'SRA IT Head',     email: 'it@sra.gov.pk',           phone: '021-99020123', city: 'Karachi',    country: 'Pakistan', source: 'Government',  status: 'active', industry: 'Government',    notes: 'Tax automation hardware' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 10 — Sales Quotations
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n📄  Section 10: Sales Quotations');

  const sqData = [
    { subject: 'Laptop Supply for IT Department',         discount_pct: 3 },
    { subject: 'Complete Office IT Setup Package',        discount_pct: 5 },
    { subject: 'Network Infrastructure Equipment',        discount_pct: 2 },
    { subject: 'Server & Storage Solution',               discount_pct: 4 },
    { subject: 'Printer & Scanner Supply',                discount_pct: 0 },
    { subject: 'CCTV Security System Installation',       discount_pct: 3 },
    { subject: 'Gaming Lab Setup Equipment',              discount_pct: 5 },
    { subject: 'Mobile Phones Bulk Order',                discount_pct: 8 },
    { subject: 'UPS & Power Backup Systems',              discount_pct: 2 },
    { subject: 'Desktop Computers for Finance Dept',      discount_pct: 3 },
    { subject: 'Monitor & Display Upgrade',               discount_pct: 4 },
    { subject: 'Annual Maintenance Contract',             discount_pct: 0 },
    { subject: 'Wi-Fi Network Expansion',                 discount_pct: 3 },
    { subject: 'Video Conferencing Equipment',            discount_pct: 5 },
    { subject: 'Keyboard, Mouse & Accessories Bundle',    discount_pct: 7 },
    { subject: 'Tablet Supply for Field Team',            discount_pct: 4 },
    { subject: 'External Storage & Backup Solution',      discount_pct: 2 },
    { subject: 'Workstation for Design Department',       discount_pct: 3 },
    { subject: 'IT Support Services Package',             discount_pct: 0 },
    { subject: 'Complete Branch IT Rollout',              discount_pct: 5 },
  ];

  for (let i = 0; i < sqData.length; i++) {
    const cust = customers[i % customers.length];
    const prod1 = products[i % products.length];
    const prod2 = products[(i + 3) % products.length];
    try {
      await post('/sales-quotations', {
        customer_id: cust.id,
        date: daysAgo(sqData.length - i),
        expiry_date: daysFromNow(30 + i),
        reference: `RFQ-${String(i + 1).padStart(4, '0')}`,
        subject: sqData[i].subject,
        discount_pct: sqData[i].discount_pct,
        shipping_charges: i % 3 === 0 ? 2500 : 0,
        lines: [
          { product_id: prod1.id, description: prod1.name, quantity: Math.ceil(Math.random() * 5) + 1, unit_price: prod1.sale_price || 10000 },
          { product_id: prod2.id, description: prod2.name, quantity: Math.ceil(Math.random() * 3) + 1, unit_price: prod2.sale_price || 5000 },
        ],
      });
    } catch (e) { console.warn(`    ⚠️  SQ ${i + 1}: ${e.message}`); }
  }
  console.log(`  ✅  ${sqData.length} Sales Quotations created`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 11 — Purchase Quotations
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n📄  Section 11: Purchase Quotations');

  const pqSubjects = [
    'Laptop Stock Replenishment Q3', 'Mobile Phone Bulk Purchase', 'Network Equipment Import',
    'Server Hardware Procurement', 'Printer Cartridge & Supplies', 'UPS Units Purchase',
    'Monitor Bulk Order', 'RAM & SSD Components', 'Keyboard & Mouse Accessories',
    'CCTV Cameras & DVR Units', 'Tablet Devices Purchase', 'Gaming Peripherals Stock',
    'Networking Cables & Patch Panels', 'Power Strip & Extensions', 'Webcam & Headset Order',
    'External HDD Procurement', 'Switch & Router Stock', 'Workstation Components',
    'IT Consumables Bundle', 'Annual Stock Purchase Agreement',
  ];
  for (let i = 0; i < pqSubjects.length; i++) {
    const vend = vendors[i % vendors.length];
    const prod1 = products[i % products.length];
    const prod2 = products[(i + 5) % products.length];
    try {
      await post('/purchase-quotations', {
        vendor_id: vend.id,
        date: daysAgo(pqSubjects.length - i),
        reference: `PQ-${String(i + 1).padStart(4, '0')}`,
        notes: `Quotation for ${pqSubjects[i]}`,
        discount: i % 4 === 0 ? 5000 : 0,
        lines: [
          { product_id: prod1.id, description: prod1.name, quantity: Math.ceil(Math.random() * 10) + 2, unit_price: prod1.purchase_price || 8000 },
          { product_id: prod2.id, description: prod2.name, quantity: Math.ceil(Math.random() * 5) + 1,  unit_price: prod2.purchase_price || 4000 },
        ],
      });
    } catch (e) { console.warn(`    ⚠️  PQ ${i + 1}: ${e.message}`); }
  }
  console.log(`  ✅  ${pqSubjects.length} Purchase Quotations created`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 12 — Sales Invoices
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n🧾  Section 12: Sales Invoices');

  const siSubjects = [
    'Laptop Supply Invoice', 'Office IT Equipment', 'Network Infrastructure',
    'Server & Storage', 'Printer Supply', 'CCTV System', 'Gaming Lab',
    'Mobile Phones', 'UPS Systems', 'Desktop Computers',
    'Monitor Supply', 'AMC Invoice', 'Wi-Fi Equipment', 'Video Conf. System',
    'Accessories Bundle', 'Tablet Devices', 'Storage Solution',
    'Workstation Supply', 'IT Support Services', 'Branch IT Setup',
    'RAM & SSD Supply', 'Keyboard & Mouse Bulk',
  ];
  for (let i = 0; i < siSubjects.length; i++) {
    const cust = customers[i % customers.length];
    const prod1 = products[i % products.length];
    const prod2 = products[(i + 4) % products.length];
    try {
      await post('/sales-invoices', {
        customer_id: cust.id,
        date: daysAgo(siSubjects.length - i),
        due_date: daysAgo(siSubjects.length - i - 30),
        reference: `SO-${String(i + 1).padStart(4, '0')}`,
        subject: siSubjects[i],
        discount_pct: i % 5 === 0 ? 5 : 0,
        shipping_charges: i % 4 === 0 ? 2500 : 0,
        lines: [
          { product_id: prod1.id, description: prod1.name, quantity: Math.ceil(Math.random() * 5) + 1, unit_price: prod1.sale_price || 10000 },
          { product_id: prod2.id, description: prod2.name, quantity: Math.ceil(Math.random() * 3) + 1, unit_price: prod2.sale_price || 6000 },
        ],
      });
    } catch (e) { console.warn(`    ⚠️  SI ${i + 1}: ${e.message}`); }
  }
  console.log(`  ✅  ${siSubjects.length} Sales Invoices created`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 13 — Purchase Invoices
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n🧾  Section 13: Purchase Invoices');

  const piSubjects = [
    'Laptop Stock Import', 'Mobile Phones Shipment', 'Network Equipment Purchase',
    'Server Hardware', 'Printer Supplies Import', 'UPS Units Import',
    'Monitor Batch', 'RAM & Components', 'Accessories Stock',
    'CCTV Cameras Import', 'Tablets Shipment', 'Gaming Peripherals',
    'Cables & Connectors', 'Power Equipment', 'Webcam Stock',
    'External Storage Import', 'Switch & Router Batch', 'Workstation Parts',
    'IT Consumables', 'Bulk Stock Purchase',
  ];
  for (let i = 0; i < piSubjects.length; i++) {
    const vend = vendors[i % vendors.length];
    const prod1 = products[i % products.length];
    const prod2 = products[(i + 6) % products.length];
    try {
      await post('/purchase-invoices', {
        vendor_id: vend.id,
        date: daysAgo(piSubjects.length - i),
        due_date: daysAgo(piSubjects.length - i - 30),
        reference: `PO-${String(i + 1).padStart(4, '0')}`,
        subject: piSubjects[i],
        discount: i % 5 === 0 ? 5000 : 0,
        lines: [
          { product_id: prod1.id, description: prod1.name, quantity: Math.ceil(Math.random() * 10) + 3, unit_price: prod1.purchase_price || 8000 },
          { product_id: prod2.id, description: prod2.name, quantity: Math.ceil(Math.random() * 5) + 1,  unit_price: prod2.purchase_price || 4500 },
        ],
      });
    } catch (e) { console.warn(`    ⚠️  PI ${i + 1}: ${e.message}`); }
  }
  console.log(`  ✅  ${piSubjects.length} Purchase Invoices created`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 14 — Expenses (requires bank account + chart of accounts)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n💸  Section 14: Expenses');

  if (bankAccounts.length > 0) {
    // Fetch chart of accounts to find expense accounts
    let expenseAccounts = [];
    try {
      const coa = await get('/chart-of-accounts');
      expenseAccounts = (Array.isArray(coa) ? coa : coa.data || [])
        .filter(a => a.type === 'expense' || a.account_type === 'expense' || (a.name || '').toLowerCase().includes('expense'));
    } catch (e) { console.warn('    ⚠️  Could not fetch chart of accounts:', e.message); }

    if (expenseAccounts.length > 0) {
      const expData = [
        { desc: 'Office Rent — June 2024',              amount: 180000, vendor_idx: 0 },
        { desc: 'Internet & Bandwidth Charges',          amount: 35000,  vendor_idx: 1 },
        { desc: 'Electricity Bill — Head Office',        amount: 28000,  vendor_idx: 2 },
        { desc: 'Fuel & Vehicle Maintenance',            amount: 22000,  vendor_idx: 3 },
        { desc: 'Staff Salaries — June 2024',            amount: 1250000,vendor_idx: 4 },
        { desc: 'Office Supplies & Stationery',          amount: 15000,  vendor_idx: 5 },
        { desc: 'Marketing & Advertising — Digital',     amount: 85000,  vendor_idx: 6 },
        { desc: 'Warehouse Rent — Karachi',              amount: 95000,  vendor_idx: 7 },
        { desc: 'Telephone & Mobile Bills',              amount: 18000,  vendor_idx: 8 },
        { desc: 'Repair & Maintenance — Office',         amount: 45000,  vendor_idx: 9 },
        { desc: 'Insurance Premium — Annual',            amount: 120000, vendor_idx: 10 },
        { desc: 'Courier & Freight Charges',             amount: 32000,  vendor_idx: 11 },
        { desc: 'Tea, Coffee & Office Refreshments',     amount: 8500,   vendor_idx: 0 },
        { desc: 'Website Hosting & Domain',              amount: 12000,  vendor_idx: 1 },
        { desc: 'Software Licenses — Annual',            amount: 75000,  vendor_idx: 2 },
        { desc: 'Bank Charges & Fees',                   amount: 5500,   vendor_idx: 3 },
        { desc: 'Trade Exhibition Participation Fee',    amount: 50000,  vendor_idx: 4 },
        { desc: 'Staff Training & Development',          amount: 35000,  vendor_idx: 5 },
        { desc: 'Printing & Branding Materials',         amount: 28000,  vendor_idx: 6 },
        { desc: 'Legal & Professional Fees',             amount: 60000,  vendor_idx: 7 },
        { desc: 'Security Services — Monthly',           amount: 25000,  vendor_idx: 8 },
        { desc: 'Generator Fuel — Warehouse',            amount: 18000,  vendor_idx: 9 },
      ];
      for (let i = 0; i < expData.length; i++) {
        const ea = pick(expenseAccounts);
        const ba = bankAccounts[i % bankAccounts.length];
        const vend = vendors[expData[i].vendor_idx % vendors.length];
        try {
          await post('/expenses', {
            date: daysAgo(expData.length - i),
            bank_account_id: ba.id,
            vendor_id: vend.id,
            comments: expData[i].desc,
            lines: [{ account_id: ea.id, description: expData[i].desc, amount: expData[i].amount }],
          });
        } catch (e) { console.warn(`    ⚠️  Expense ${i + 1}: ${e.message}`); }
      }
      console.log(`  ✅  ${expData.length} Expenses created`);
    } else {
      console.warn('  ⚠️  No expense accounts found in Chart of Accounts — skipping expenses');
      console.warn('       Go to Chart of Accounts and add some expense-type accounts first');
    }
  } else {
    console.warn('  ⚠️  No bank accounts created — skipping expenses');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DONE
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(60));
  console.log('🎉  TechZone Electronics demo data seeding COMPLETE!');
  console.log('     Refresh the page and explore each module.');
  console.log('═'.repeat(60));
  console.log('\nSummary of what was created:');
  console.log('  • 10  Customer Categories');
  console.log('  •  8  Vendor Categories');
  console.log('  • 12  Product Categories');
  console.log('  • 22  Brands');
  console.log('  •  6  Taxes');
  console.log('  •  9  Departments  (HR & Payroll)');
  console.log('  • 14  Designations (HR & Payroll)');
  console.log('  • 20  Employees    (HR & Payroll)');
  console.log('  • 20  Projects     (HR & Payroll)');
  console.log('  • 22  Customers');
  console.log('  • 22  Vendors');
  console.log('  • 25  Products & Services');
  console.log('  • 20  Sales Persons');
  console.log('  • 20  Other Contacts');
  console.log('  •  6  Warehouses');
  console.log('  •  7  Bank Accounts');
  console.log('  • 12  Couriers');
  console.log('  • 20  CRM Leads');
  console.log('  • 20  Prospects');
  console.log('  • 20  Sales Quotations');
  console.log('  • 20  Purchase Quotations');
  console.log('  • 22  Sales Invoices');
  console.log('  • 20  Purchase Invoices');
  console.log('  • 22  Expenses (if Chart of Accounts has expense accounts)');
})();
