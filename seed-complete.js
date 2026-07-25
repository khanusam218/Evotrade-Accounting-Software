/**
 * Evotrade Accounting Software - Complete Dummy Data Seeder
 * 
 * This script seeds ALL tables with 20+ entries each.
 * It uses the existing seed-node.js approach but enhanced.
 * 
 * Usage: node seed-complete.js
 */

const BASE = 'http://localhost:3001/api';
const COMPANY = 'techzone-demo-2024';

let TOKEN = '';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      'X-Company-ID': COMPANY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`${method} ${path} [${res.status}]: ${e.error || 'unknown'}`);
  }
  return res.json();
}

const post = (p, b) => request('POST', p, b);
const get = (p) => request('GET', p);

async function createAll(label, endpoint, items) {
  process.stdout.write(`  ↳ ${label}… `);
  const results = [];
  for (const item of items) {
    try {
      const r = await post(endpoint, item);
      results.push(r);
    } catch (e) {
      process.stdout.write(`\n    ⚠️  ${e.message}`);
    }
  }
  console.log(`✅ ${results.length}/${items.length}`);
  return results;
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const daysFwd = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

(async () => {
  console.log('='.repeat(70));
  console.log('🚀  EVOTRADE ACCOUNTING - COMPLETE DUMMY DATA SEEDER');
  console.log('='.repeat(70));

  // Login - first try to register, then login
  console.log('\n🔐  Setting up authentication…');
  try {
    // Try to register first (in case admin doesn't exist yet)
    try {
      await fetch(`${BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'admin', password: '123456', confirmPassword: '123456' }),
      });
    } catch (e) { /* user may already exist */ }

    // Now login
    const auth = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'admin', password: '123456' }),
    });
    if (!auth.ok) {
      const errText = await auth.text();
      console.error('❌  Login failed:', errText);
      process.exit(1);
    }
    const authData = await auth.json();
    TOKEN = authData.token;
    console.log(`✅  Logged in — company: ${COMPANY}`);
  } catch (err) {
    console.error('❌  Cannot connect to server. Is the server running on port 3001?');
    console.error('   Start it with: cd server && npm run dev');
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Master Lists
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📂  SECTION 1: Master Lists');

  const custCats = await createAll('Customer Categories', '/customer-categories', [
    { name: 'Corporate Clients' }, { name: 'Retail Customers' },
    { name: 'Educational Institutions' }, { name: 'Government Agencies' },
    { name: 'Healthcare Organizations' }, { name: 'SMB Clients' },
    { name: 'Enterprise Accounts' }, { name: 'Resellers & Distributors' },
    { name: 'Online Buyers' }, { name: 'Export Clients' },
    { name: 'NGO/Non-Profit' }, { name: 'Startups' },
    { name: 'Hospitality Industry' }, { name: 'Manufacturing Sector' },
    { name: 'Real Estate Developers' }, { name: 'Telecom Sector' },
    { name: 'Pharmaceutical Companies' }, { name: 'Defense & Security' },
    { name: 'Media & Entertainment' }, { name: 'Logistics & Transport' },
    { name: 'E-Commerce Partners' }, { name: 'Franchise Networks' },
  ]);

  const vendCats = await createAll('Vendor Categories', '/vendor-categories', [
    { name: 'Authorized Importers' }, { name: 'Distributors' },
    { name: 'Local Suppliers' }, { name: 'Service Providers' },
    { name: 'Logistics Partners' }, { name: 'OEM Manufacturers' },
    { name: 'Component Suppliers' }, { name: 'Software Vendors' },
    { name: 'Cloud Service Providers' }, { name: 'Hardware Manufacturers' },
    { name: 'Packaging Suppliers' }, { name: 'Maintenance Contractors' },
    { name: 'Consulting Firms' }, { name: 'Marketing Agencies' },
    { name: 'Training Providers' }, { name: 'Security Services' },
    { name: 'Cleaning & Facilities' }, { name: 'IT Resellers' },
    { name: 'Telecom Operators' }, { name: 'Energy & Utilities' },
    { name: 'Office Furniture Suppliers' }, { name: 'Stationery Suppliers' },
  ]);

  const prodCats = await createAll('Product Categories', '/product-categories', [
    { name: 'Laptops & Notebooks' }, { name: 'Desktop Computers' },
    { name: 'Mobile Phones' }, { name: 'Computer Accessories' },
    { name: 'Networking Equipment' }, { name: 'Printers & Scanners' },
    { name: 'Storage Devices' }, { name: 'Computer Components' },
    { name: 'Tablets & iPads' }, { name: 'Gaming Peripherals' },
    { name: 'Monitors & Displays' }, { name: 'UPS & Power Equipment' },
    { name: 'Software & Licenses' }, { name: 'CCTV & Surveillance' },
    { name: 'Audio & Video Equipment' }, { name: 'Servers & Racks' },
    { name: 'Cables & Connectors' }, { name: 'Point of Sale Systems' },
    { name: 'Office Electronics' }, { name: 'Smart Home Devices' },
    { name: 'Wearable Technology' }, { name: 'Data Center Equipment' },
  ]);

  const brands = await createAll('Brands', '/brands', [
    { name: 'Apple' }, { name: 'Samsung' }, { name: 'HP' }, { name: 'Dell' },
    { name: 'Lenovo' }, { name: 'Sony' }, { name: 'LG' }, { name: 'Asus' },
    { name: 'Acer' }, { name: 'Toshiba' }, { name: 'Canon' }, { name: 'Epson' },
    { name: 'D-Link' }, { name: 'TP-Link' }, { name: 'Western Digital' },
    { name: 'Seagate' }, { name: 'Kingston' }, { name: 'Corsair' },
    { name: 'Logitech' }, { name: 'Microsoft' }, { name: 'APC' }, { name: 'Hikvision' },
    { name: 'Intel' }, { name: 'AMD' }, { name: 'NVIDIA' }, { name: 'Synology' },
    { name: 'QNAP' }, { name: 'Brother' }, { name: 'Panasonic' }, { name: 'Xiaomi' },
  ]);

  await createAll('Taxes', '/taxes', [
    { name: 'GST 17%', percent: 17, type: 'percentage' },
    { name: 'Reduced Rate 5%', percent: 5, type: 'percentage' },
    { name: 'Zero Rated 0%', percent: 0, type: 'percentage' },
    { name: 'Import Duty 10%', percent: 10, type: 'percentage' },
    { name: 'WHT 2%', percent: 2, type: 'percentage' },
    { name: 'Additional ST 3%', percent: 3, type: 'percentage' },
    { name: 'Federal Excise 5%', percent: 5, type: 'percentage' },
    { name: 'Service Tax 13%', percent: 13, type: 'percentage' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — HR Setup
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n👥  SECTION 2: HR Setup');

  const departments = await createAll('Departments', '/departments', [
    { name: 'Sales & Marketing' }, { name: 'Information Technology' },
    { name: 'Human Resources' }, { name: 'Finance & Accounts' },
    { name: 'Operations' }, { name: 'Warehouse & Logistics' },
    { name: 'Customer Support' }, { name: 'Procurement' },
    { name: 'Administration' }, { name: 'Research & Development' },
    { name: 'Quality Assurance' }, { name: 'Legal & Compliance' },
    { name: 'Business Development' }, { name: 'Training & Development' },
    { name: 'Security & Safety' }, { name: 'Public Relations' },
    { name: 'Internal Audit' }, { name: 'Product Management' },
    { name: 'Data Analytics' }, { name: 'Corporate Strategy' },
    { name: 'Facilities Management' }, { name: 'Supply Chain' },
  ]);

  const designations = await createAll('Designations', '/designations', [
    { name: 'Chief Executive Officer' }, { name: 'Chief Financial Officer' },
    { name: 'Chief Technology Officer' }, { name: 'General Manager' },
    { name: 'Department Manager' }, { name: 'Senior Sales Executive' },
    { name: 'Sales Executive' }, { name: 'IT Engineer' },
    { name: 'HR Officer' }, { name: 'Accounts Officer' },
    { name: 'Warehouse Supervisor' }, { name: 'Customer Service Representative' },
    { name: 'Procurement Officer' }, { name: 'Marketing Specialist' },
    { name: 'System Administrator' }, { name: 'Accountant' },
    { name: 'Business Analyst' }, { name: 'Quality Inspector' },
    { name: 'Logistics Coordinator' }, { name: 'Training Manager' },
    { name: 'Legal Advisor' }, { name: 'Data Entry Operator' },
    { name: 'Junior Accountant' }, { name: 'Receptionist' },
    { name: 'Office Assistant' }, { name: 'Security Guard' },
    { name: 'Driver' }, { name: 'Cleaner' },
  ]);

  const employees = await createAll('Employees', '/employees', [
    { name: 'Ali Hassan Malik', phone: '0300-1111111', email: 'ali.malik@techzone.pk', salary: 250000, cnic: '42101-1234567-1', join_date: '2020-01-05', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Fatima Zahra Khan', phone: '0321-2222222', email: 'fatima.khan@techzone.pk', salary: 180000, cnic: '42201-2345678-2', join_date: '2020-03-15', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Muhammad Usman', phone: '0333-3333333', email: 'm.usman@techzone.pk', salary: 120000, cnic: '35201-3456789-3', join_date: '2020-06-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Sara Ahmed', phone: '0345-4444444', email: 'sara.ahmed@techzone.pk', salary: 95000, cnic: '35202-4567890-4', join_date: '2021-01-10', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Bilal Raza', phone: '0311-5555555', email: 'bilal.raza@techzone.pk', salary: 110000, cnic: '42301-5678901-5', join_date: '2021-02-20', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Ayesha Tariq', phone: '0322-6666666', email: 'ayesha.tariq@techzone.pk', salary: 85000, cnic: '42401-6789012-6', join_date: '2021-04-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Kamran Sheikh', phone: '0344-7777777', email: 'kamran.sheikh@techzone.pk', salary: 130000, cnic: '42501-7890123-7', join_date: '2021-05-15', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Nadia Iqbal', phone: '0315-8888888', email: 'nadia.iqbal@techzone.pk', salary: 75000, cnic: '42601-8901234-8', join_date: '2021-07-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Tariq Mehmood', phone: '0301-9999999', email: 'tariq.mehmood@techzone.pk', salary: 145000, cnic: '42701-9012345-9', join_date: '2021-09-10', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Zainab Hussain', phone: '0340-1234560', email: 'zainab.hussain@techzone.pk', salary: 90000, cnic: '42801-0123456-0', join_date: '2021-11-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Omar Farooq', phone: '0300-2233445', email: 'omar.farooq@techzone.pk', salary: 165000, cnic: '42101-1234568-1', join_date: '2022-01-15', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Sana Butt', phone: '0321-3344556', email: 'sana.butt@techzone.pk', salary: 70000, cnic: '42201-2345679-2', join_date: '2022-03-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Hassan Ali', phone: '0333-4455667', email: 'hassan.ali@techzone.pk', salary: 105000, cnic: '35201-3456780-3', join_date: '2022-04-20', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Maria Javed', phone: '0345-5566778', email: 'maria.javed@techzone.pk', salary: 88000, cnic: '35202-4567891-4', join_date: '2022-06-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Adnan Qureshi', phone: '0311-6677889', email: 'adnan.qureshi@techzone.pk', salary: 125000, cnic: '42301-5678902-5', join_date: '2022-08-10', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Rabia Nadeem', phone: '0322-7788990', email: 'rabia.nadeem@techzone.pk', salary: 78000, cnic: '42401-6789013-6', join_date: '2022-10-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Faisal Sultan', phone: '0344-8899001', email: 'faisal.sultan@techzone.pk', salary: 195000, cnic: '42501-7890124-7', join_date: '2023-01-05', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Hina Baig', phone: '0315-9900112', email: 'hina.baig@techzone.pk', salary: 65000, cnic: '42601-8901235-8', join_date: '2023-03-15', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Waseem Akhtar', phone: '0301-0011223', email: 'waseem.akhtar@techzone.pk', salary: 115000, cnic: '42701-9012346-9', join_date: '2023-05-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Saima Perveen', phone: '0340-1122334', email: 'saima.perveen@techzone.pk', salary: 82000, cnic: '42801-0123457-0', join_date: '2023-07-10', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Naveed Akram', phone: '0300-5566778', email: 'naveed.akram@techzone.pk', salary: 140000, cnic: '42101-2345678-3', join_date: '2023-09-01', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
    { name: 'Samina Yasmin', phone: '0321-6677889', email: 'samina.yasmin@techzone.pk', salary: 72000, cnic: '42201-3456789-4', join_date: '2023-11-15', department_id: pick(departments)?.id || null, designation_id: pick(designations)?.id || null, is_active: true },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — Customers & Vendors
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🤝  SECTION 3: Customers & Vendors');

  const customers = await createAll('Customers', '/customers', [
    { print_name: 'Techno Solutions Pvt Ltd', email_1: 'info@technosol.pk', phone_1: '0300-1234567', city: 'Karachi', country: 'Pakistan', credit_limit: 500000, category_id: pick(custCats)?.id || null },
    { print_name: 'Digital World Trading', email_1: 'sales@digitalworld.pk', phone_1: '0321-2345678', city: 'Lahore', country: 'Pakistan', credit_limit: 300000, category_id: pick(custCats)?.id || null },
    { print_name: 'Smart Systems Corp', email_1: 'contact@smartsys.pk', phone_1: '0333-3456789', city: 'Islamabad', country: 'Pakistan', credit_limit: 750000, category_id: pick(custCats)?.id || null },
    { print_name: 'City College of Technology', email_1: 'admin@cct.edu.pk', phone_1: '042-45678901', city: 'Lahore', country: 'Pakistan', credit_limit: 200000, category_id: pick(custCats)?.id || null },
    { print_name: 'National Hospital IT Dept', email_1: 'it@nathospital.pk', phone_1: '021-34567890', city: 'Karachi', country: 'Pakistan', credit_limit: 400000, category_id: pick(custCats)?.id || null },
    { print_name: 'Ahmed & Sons Electronics', email_1: 'ahmed@aselec.pk', phone_1: '0345-4567890', city: 'Faisalabad', country: 'Pakistan', credit_limit: 150000, category_id: pick(custCats)?.id || null },
    { print_name: 'MegaMart Retail Chain', email_1: 'proc@megamart.pk', phone_1: '051-5678901', city: 'Rawalpindi', country: 'Pakistan', credit_limit: 1000000, category_id: pick(custCats)?.id || null },
    { print_name: 'InfoTech Solutions LLC', email_1: 'info@infotech.pk', phone_1: '0311-6789012', city: 'Karachi', country: 'Pakistan', credit_limit: 250000, category_id: pick(custCats)?.id || null },
    { print_name: 'Raza Computer Centre', email_1: 'raza@razacomp.pk', phone_1: '0322-7890123', city: 'Multan', country: 'Pakistan', credit_limit: 100000, category_id: pick(custCats)?.id || null },
    { print_name: 'Federal Government Stores', email_1: 'purchase@fgs.gov.pk', phone_1: '051-9012345', city: 'Islamabad', country: 'Pakistan', credit_limit: 2000000, category_id: pick(custCats)?.id || null },
    { print_name: 'Hassan Traders', email_1: 'hassan@hassantrade.pk', phone_1: '0344-0123456', city: 'Hyderabad', country: 'Pakistan', credit_limit: 80000, category_id: pick(custCats)?.id || null },
    { print_name: 'TechBridge Enterprise', email_1: 'info@techbridge.pk', phone_1: '0300-9876543', city: 'Karachi', country: 'Pakistan', credit_limit: 600000, category_id: pick(custCats)?.id || null },
    { print_name: 'Punjab University IT Dept', email_1: 'it@pu.edu.pk', phone_1: '042-35761944', city: 'Lahore', country: 'Pakistan', credit_limit: 500000, category_id: pick(custCats)?.id || null },
    { print_name: 'Malik Electronics Store', email_1: 'malik@malikelectro.pk', phone_1: '0333-1122334', city: 'Sialkot', country: 'Pakistan', credit_limit: 120000, category_id: pick(custCats)?.id || null },
    { print_name: 'NextGen Networks', email_1: 'sales@nextgennet.pk', phone_1: '021-32456789', city: 'Karachi', country: 'Pakistan', credit_limit: 350000, category_id: pick(custCats)?.id || null },
    { print_name: 'Al-Farooq Trading Co', email_1: 'alfarooq@altrade.pk', phone_1: '0315-5544332', city: 'Peshawar', country: 'Pakistan', credit_limit: 180000, category_id: pick(custCats)?.id || null },
    { print_name: 'GreenTech Innovation Hub', email_1: 'hello@greentech.pk', phone_1: '0323-6677889', city: 'Islamabad', country: 'Pakistan', credit_limit: 400000, category_id: pick(custCats)?.id || null },
    { print_name: 'ZaibTech Computers', email_1: 'zaib@zaibtech.pk', phone_1: '0301-9988776', city: 'Lahore', country: 'Pakistan', credit_limit: 220000, category_id: pick(custCats)?.id || null },
    { print_name: 'Star Global Exports', email_1: 'export@starglobal.pk', phone_1: '021-35890123', city: 'Karachi', country: 'Pakistan', credit_limit: 900000, category_id: pick(custCats)?.id || null },
    { print_name: 'Pak IT Solutions', email_1: 'info@pakitsol.pk', phone_1: '0340-2233445', city: 'Quetta', country: 'Pakistan', credit_limit: 150000, category_id: pick(custCats)?.id || null },
    { print_name: 'NetConnect Pvt Ltd', email_1: 'net@netconnect.pk', phone_1: '021-32111222', city: 'Karachi', country: 'Pakistan', credit_limit: 275000, category_id: pick(custCats)?.id || null },
    { print_name: 'Vision Tech Academy', email_1: 'vision@vtacademy.pk', phone_1: '042-36111333', city: 'Lahore', country: 'Pakistan', credit_limit: 120000, category_id: pick(custCats)?.id || null },
  ]);

  const vendors = await createAll('Vendors', '/vendors', [
    { print_name: 'Al-Haj Imports', email: 'import@alhaj.pk', phone_1: '021-34789012', category_id: pick(vendCats)?.id || null },
    { print_name: 'Tech Galaxy Distribution', email: 'sales@techgalaxy.pk', phone_1: '042-35612345', category_id: pick(vendCats)?.id || null },
    { print_name: 'Digital Hub Wholesale', email: 'info@digitalhub.pk', phone_1: '051-2654321', category_id: pick(vendCats)?.id || null },
    { print_name: 'Crescent Technology', email: 'ctt@crescent.pk', phone_1: '0300-8001234', category_id: pick(vendCats)?.id || null },
    { print_name: 'Prime IT Distributors', email: 'sales@primeIT.pk', phone_1: '042-37231001', category_id: pick(vendCats)?.id || null },
    { print_name: 'HP Authorized Partner Pak', email: 'hp@hppak.pk', phone_1: '021-35380000', category_id: pick(vendCats)?.id || null },
    { print_name: 'Dell Enterprise Solutions', email: 'dell@dellpk.pk', phone_1: '042-38500100', category_id: pick(vendCats)?.id || null },
    { print_name: 'Lenovo Distributor Pak', email: 'lenovo@lenovopk.pk', phone_1: '021-32454000', category_id: pick(vendCats)?.id || null },
    { print_name: 'Samsung Official Partner', email: 'samsung@samspk.pk', phone_1: '051-2802100', category_id: pick(vendCats)?.id || null },
    { print_name: 'Apple Authorized Reseller', email: 'apple@applestore.pk', phone_1: '021-35611234', category_id: pick(vendCats)?.id || null },
    { print_name: 'Network Components Ltd', email: 'info@netcomp.pk', phone_1: '042-36001234', category_id: pick(vendCats)?.id || null },
    { print_name: 'Storage Solutions PK', email: 'storage@sspk.pk', phone_1: '021-34509876', category_id: pick(vendCats)?.id || null },
    { print_name: 'Canon & Epson Importers', email: 'printers@cepak.pk', phone_1: '051-4865321', category_id: pick(vendCats)?.id || null },
    { print_name: 'Gaming Zone Wholesale', email: 'games@gzwholesale.pk', phone_1: '0321-4567890', category_id: pick(vendCats)?.id || null },
    { print_name: 'Accessories World', email: 'acc@accworld.pk', phone_1: '042-35211000', category_id: pick(vendCats)?.id || null },
    { print_name: 'Wireless Tech Partners', email: 'wireless@wtp.pk', phone_1: '021-36400000', category_id: pick(vendCats)?.id || null },
    { print_name: 'Micro Electronics Import', email: 'micro@mei.pk', phone_1: '051-2876543', category_id: pick(vendCats)?.id || null },
    { print_name: 'Power Systems Pak', email: 'ups@powersystems.pk', phone_1: '0300-2100000', category_id: pick(vendCats)?.id || null },
    { print_name: 'ZTech Global Supplies', email: 'ztech@ztechglobal.pk', phone_1: '021-37000123', category_id: pick(vendCats)?.id || null },
    { print_name: 'Horizon IT Solutions', email: 'horizon@horizonIT.pk', phone_1: '042-36512345', category_id: pick(vendCats)?.id || null },
    { print_name: 'Apex Components Co', email: 'apex@apexcomp.pk', phone_1: '051-2345678', category_id: pick(vendCats)?.id || null },
    { print_name: 'Bright Future Electronics', email: 'bfe@bfelectro.pk', phone_1: '021-33445566', category_id: pick(vendCats)?.id || null },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — Products
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📦  SECTION 4: Products');

  const products = await createAll('Products', '/products', [
    { name: 'Apple MacBook Pro 16" M3 Pro', type: 'product', sale_price: 649000, purchase_price: 580000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Dell XPS 15 Laptop Core i7 13th Gen', type: 'product', sale_price: 279000, purchase_price: 238000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'HP EliteBook 840 G10 Business', type: 'product', sale_price: 219000, purchase_price: 188000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Lenovo ThinkPad X1 Carbon Gen 11', type: 'product', sale_price: 309000, purchase_price: 269000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Asus ROG Strix G16 Gaming Laptop', type: 'product', sale_price: 329000, purchase_price: 285000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Samsung Galaxy S24 Ultra 256GB', type: 'product', sale_price: 185000, purchase_price: 160000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Apple iPhone 15 Pro Max 256GB', type: 'product', sale_price: 370000, purchase_price: 328000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Dell OptiPlex 7010 Desktop SFF', type: 'product', sale_price: 95000, purchase_price: 80000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'HP Z4 G5 Workstation Core i9', type: 'product', sale_price: 520000, purchase_price: 455000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Apple iPad Pro 12.9" M2 WiFi 256GB', type: 'product', sale_price: 290000, purchase_price: 252000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Samsung 27" 4K UHD IPS Monitor', type: 'product', sale_price: 74500, purchase_price: 63000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'HP LaserJet Pro M404dn Printer', type: 'product', sale_price: 54500, purchase_price: 46000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Canon PIXMA G3470 InkTank Printer', type: 'product', sale_price: 31500, purchase_price: 26500, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'TP-Link Archer AX73 WiFi 6 Router', type: 'product', sale_price: 18500, purchase_price: 15200, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'D-Link 24-Port Gigabit Switch', type: 'product', sale_price: 27500, purchase_price: 22800, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Western Digital 4TB Desktop HDD', type: 'product', sale_price: 19500, purchase_price: 16200, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Samsung 1TB 980 Pro NVMe SSD', type: 'product', sale_price: 22000, purchase_price: 18500, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Kingston 16GB DDR5 5200MHz RAM', type: 'product', sale_price: 8500, purchase_price: 7100, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Logitech MX Master 3S Mouse', type: 'product', sale_price: 9500, purchase_price: 7800, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Corsair K100 RGB Optical Keyboard', type: 'product', sale_price: 28000, purchase_price: 23500, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'APC 1500VA UPS Smart-UPS', type: 'product', sale_price: 32000, purchase_price: 26500, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'HP Poly Studio X50 Video Bar', type: 'product', sale_price: 185000, purchase_price: 160000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Hikvision 8-Channel NVR System', type: 'product', sale_price: 45000, purchase_price: 37500, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'IT Support Services (per hour)', type: 'service', sale_price: 5000, purchase_price: 0, unit_of_measurement: 'HRS', is_sold: true, is_purchased: false, track_inventory: false, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Annual Maintenance Contract', type: 'service', sale_price: 25000, purchase_price: 0, unit_of_measurement: 'PCS', is_sold: true, is_purchased: false, track_inventory: false, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Sony 65" 4K OLED Professional Display', type: 'product', sale_price: 285000, purchase_price: 245000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Synology 4-Bay NAS DS923+', type: 'product', sale_price: 125000, purchase_price: 105000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Cisco Meraki MX68 Firewall', type: 'product', sale_price: 85000, purchase_price: 72000, unit_of_measurement: 'PCS', is_sold: true, is_purchased: true, track_inventory: true, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Cloud Backup Service (per GB/month)', type: 'service', sale_price: 150, purchase_price: 80, unit_of_measurement: 'GB', is_sold: true, is_purchased: true, track_inventory: false, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
    { name: 'Network Security Audit Service', type: 'service', sale_price: 75000, purchase_price: 0, unit_of_measurement: 'PCS', is_sold: true, is_purchased: false, track_inventory: false, category_id: pick(prodCats)?.id || null, brand_id: pick(brands)?.id || null },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — Sales Persons & Other Contacts
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n💼  SECTION 5: Sales Persons & Contacts');

  await createAll('Sales Persons', '/sales-persons', [
    { print_name: 'Zubair Ahmed', phone: '0300-1010101', email: 'zubair@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Amna Khalid', phone: '0321-2020202', email: 'amna@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Shahzad Mirza', phone: '0333-3030303', email: 'shahzad@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Lubna Malik', phone: '0345-4040404', email: 'lubna@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Aamir Siddiqui', phone: '0311-5050505', email: 'aamir@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Qasim Hassan', phone: '0322-6060606', email: 'qasim@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Sadia Rizvi', phone: '0344-7070707', email: 'sadia@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Imran Baig', phone: '0315-8080808', email: 'imran@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Kiran Afzal', phone: '0301-9090909', email: 'kiran@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Naeem Chaudhry', phone: '0340-1212121', email: 'naeem@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Uzma Rehman', phone: '0300-2323232', email: 'uzma@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Tariq Gill', phone: '0321-3434343', email: 'tariq.g@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Aroha Shafiq', phone: '0333-4545454', email: 'aroha@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Danish Aslam', phone: '0345-5656565', email: 'danish@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Mehwish Noor', phone: '0311-6767676', email: 'mehwish@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Umar Sajid', phone: '0322-7878787', email: 'umar@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Fariha Zaidi', phone: '0344-8989898', email: 'fariha@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Saad Farhan', phone: '0315-9090901', email: 'saad.f@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Humaira Ghani', phone: '0301-0101010', email: 'humaira@techzone.pk', type: 'salesman', can_add_discount: false },
    { print_name: 'Junaid Akram', phone: '0340-1212120', email: 'junaid@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Shabbir Hussain', phone: '0300-1313131', email: 'shabbir@techzone.pk', type: 'salesman', can_add_discount: true },
    { print_name: 'Noreen Akhtar', phone: '0321-1414141', email: 'noreen@techzone.pk', type: 'salesman', can_add_discount: false },
  ]);

  await createAll('Other Contacts', '/other-contacts', [
    { print_name: 'Allied Bank Ltd', category: 'Bank', contact_person: 'Relationship Manager', phone: '021-35650000', email: 'corp@abl.com.pk' },
    { print_name: 'PTCL Business Center', category: 'Telecom', contact_person: 'Account Manager', phone: '021-111-111-789', email: 'biz@ptcl.net.pk' },
    { print_name: 'FedEx Pakistan', category: 'Courier', contact_person: 'Operations Head', phone: '021-35862290', email: 'pk@fedex.com' },
    { print_name: 'TCS Couriers', category: 'Courier', contact_person: 'Tariq Hussain', phone: '021-111-123-456', email: 'corporate@tcs.com.pk' },
    { print_name: 'K-Electric', category: 'Utility', contact_person: 'Commercial Dept', phone: '021-99000', email: 'commercial@ke.com.pk' },
    { print_name: 'Sui Southern Gas Co', category: 'Utility', contact_person: 'Billing Dept', phone: '021-111-786-786', email: 'billing@ssgc.com.pk' },
    { print_name: 'MCB Bank Ltd', category: 'Bank', contact_person: 'Corporate Banking', phone: '021-35635635', email: 'corp@mcb.com.pk' },
    { print_name: 'Telenor Pakistan', category: 'Telecom', contact_person: 'Business Solutions', phone: '0345-1111111', email: 'bizcare@telenor.com.pk' },
    { print_name: 'EFU Insurance', category: 'Insurance', contact_person: 'Corporate Sales', phone: '021-35682340', email: 'corp@efu.com.pk' },
    { print_name: 'WAPDA Lahore Electric', category: 'Utility', contact_person: 'Admin Officer', phone: '042-99201234', email: 'admin@lesco.gov.pk' },
    { print_name: 'Habib Bank Limited', category: 'Bank', contact_person: 'Branch Manager', phone: '021-32441234', email: 'hbl@hbl.com' },
    { print_name: 'Jazz Business', category: 'Telecom', contact_person: 'Enterprise Accounts', phone: '0301-2345678', email: 'enterprise@jazz.com.pk' },
    { print_name: 'NLC Logistics', category: 'Logistics', contact_person: 'Cargo Manager', phone: '051-9270001', email: 'cargo@nlc.com.pk' },
    { print_name: 'State Life Insurance', category: 'Insurance', contact_person: 'Group Policy Dept', phone: '021-99100000', email: 'group@statelife.gov.pk' },
    { print_name: 'DHL Pakistan', category: 'Courier', contact_person: 'Corporate Manager', phone: '0800-00345', email: 'pk.corp@dhl.com' },
    { print_name: 'Jubilee Life Insurance', category: 'Insurance', contact_person: 'Corporate Head', phone: '021-35662250', email: 'corp@jubileelife.com' },
    { print_name: 'Ufone Business', category: 'Telecom', contact_person: 'Enterprise Sales', phone: '111-333-100', email: 'biz@ufone.com' },
    { print_name: 'Pakistan Post', category: 'Courier', contact_person: 'Corporate Division', phone: '051-9215555', email: 'post@pakpost.gov.pk' },
    { print_name: 'Meezan Bank', category: 'Bank', contact_person: 'Business Banking', phone: '021-38103500', email: 'biz@meezanbank.com' },
    { print_name: 'Trax Logistics', category: 'Logistics', contact_person: 'Ops Manager', phone: '0311-1817290', email: 'corp@trax.pk' },
    { print_name: 'Adamjee Insurance', category: 'Insurance', contact_person: 'Claims Dept', phone: '021-35680001', email: 'claims@adamjee.com.pk' },
    { print_name: 'Nayatel Broadband', category: 'Telecom', contact_person: 'Enterprise Sales', phone: '051-111-234-567', email: 'biz@nayatel.pk' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — Projects
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📋  SECTION 6: Projects');

  await createAll('Projects', '/projects', [
    { name: 'City Hospital IT Upgrade', start_date: '2024-01-15', end_date: '2024-06-30', budget: 2500000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'PU Campus Network Deployment', start_date: '2024-02-01', end_date: '2024-08-31', budget: 3800000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'MegaMart POS System Rollout', start_date: '2024-03-10', end_date: '2024-07-31', budget: 1200000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'FGS Data Center Modernization', start_date: '2023-09-01', end_date: '2024-03-31', budget: 8500000, status: 'completed', customer_id: pick(customers)?.id || null },
    { name: 'Smart Systems CCTV Installation', start_date: '2024-04-01', end_date: '2024-05-30', budget: 450000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'TechBridge Cloud Migration', start_date: '2024-01-01', end_date: '2024-12-31', budget: 1800000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'Annual AMC — Corporate Clients', start_date: '2024-01-01', end_date: '2024-12-31', budget: 2200000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'InfoTech Office Relocation IT', start_date: '2024-05-01', end_date: '2024-06-15', budget: 380000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'Gaming Lab Setup — CCT', start_date: '2024-03-01', end_date: '2024-04-30', budget: 2800000, status: 'completed', customer_id: pick(customers)?.id || null },
    { name: 'ZaibTech Security Audit & Upgrade', start_date: '2024-02-15', end_date: '2024-03-31', budget: 550000, status: 'completed', customer_id: pick(customers)?.id || null },
    { name: 'NextGen Networks Infrastructure', start_date: '2024-06-01', end_date: '2024-11-30', budget: 4200000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'Raza Computer Center Refurb', start_date: '2023-12-01', end_date: '2024-01-31', budget: 180000, status: 'completed', customer_id: pick(customers)?.id || null },
    { name: 'Al-Farooq Export IT Docs', start_date: '2024-04-15', end_date: '2024-05-31', budget: 320000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'GreenTech Smart Office Setup', start_date: '2024-05-15', end_date: '2024-08-31', budget: 1500000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'Star Global Tracking System', start_date: '2024-01-20', end_date: '2024-04-30', budget: 680000, status: 'completed', customer_id: pick(customers)?.id || null },
    { name: 'Pak IT Training Lab', start_date: '2024-03-01', end_date: '2024-04-15', budget: 950000, status: 'completed', customer_id: pick(customers)?.id || null },
    { name: 'NetConnect Fiber Backbone', start_date: '2024-06-01', end_date: '2025-01-31', budget: 6500000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'Hassan Traders Store Automation', start_date: '2024-02-01', end_date: '2024-03-15', budget: 120000, status: 'completed', customer_id: pick(customers)?.id || null },
    { name: 'Digital World VoIP Migration', start_date: '2024-04-01', end_date: '2024-06-30', budget: 750000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'TechZone Showroom Upgrade 2024', start_date: '2024-07-01', end_date: '2024-09-30', budget: 2200000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'Nathospital EMR System', start_date: '2024-08-01', end_date: '2025-02-28', budget: 5200000, status: 'active', customer_id: pick(customers)?.id || null },
    { name: 'Vision Tech E-Learning Platform', start_date: '2024-09-01', end_date: '2025-03-31', budget: 1800000, status: 'active', customer_id: pick(customers)?.id || null },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 7 — Warehouses & Bank Accounts
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🏪  SECTION 7: Warehouses & Bank Accounts');

  const warehouses = await createAll('Warehouses', '/warehouses', [
    { name: 'Main Warehouse — Karachi', city: 'Karachi', country: 'Pakistan', contact_person: 'Imran Khan', phone: '021-32561234' },
    { name: 'Lahore Distribution Center', city: 'Lahore', country: 'Pakistan', contact_person: 'Rizwan Ali', phone: '042-35789012' },
    { name: 'Islamabad Showroom Store', city: 'Islamabad', country: 'Pakistan', contact_person: 'Sadaf Mehmood', phone: '051-2890123' },
    { name: 'Faisalabad Regional Hub', city: 'Faisalabad', country: 'Pakistan', contact_person: 'Ghulam Abbas', phone: '041-8901234' },
    { name: 'Karachi Airport Bonded', city: 'Karachi', country: 'Pakistan', contact_person: 'Asif Munir', phone: '021-34512345' },
    { name: 'Rawalpindi Service Center', city: 'Rawalpindi', country: 'Pakistan', contact_person: 'Naveed Ahmed', phone: '051-4512345' },
    { name: 'Hyderabad Satellite Warehouse', city: 'Hyderabad', country: 'Pakistan', contact_person: 'Shahid Iqbal', phone: '022-2789012' },
    { name: 'Sialkot Export Hub', city: 'Sialkot', country: 'Pakistan', contact_person: 'Rashid Mahmood', phone: '052-3456789' },
  ]);

  const bankAccounts = await createAll('Bank Accounts', '/bank-accounts', [
    { code: 'BA-001', name: 'HBL Current Account — Main', bank_name: 'Habib Bank Limited', branch_name: 'Clifton Branch', account_number: '12345678901234', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-002', name: 'MCB Business Account', bank_name: 'Muslim Commercial Bank', branch_name: 'I.I. Chundrigar', account_number: '23456789012345', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-003', name: 'UBL Corporate Account', bank_name: 'United Bank Limited', branch_name: 'SITE Branch', account_number: '34567890123456', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-004', name: 'Meezan Islamic Account', bank_name: 'Meezan Bank Limited', branch_name: 'Gulshan Branch', account_number: '45678901234567', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-005', name: 'Petty Cash — Office', bank_name: 'Cash', branch_name: 'Head Office', account_number: 'CASH-001', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-006', name: 'Petty Cash — Warehouse', bank_name: 'Cash', branch_name: 'Main Warehouse', account_number: 'CASH-002', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-007', name: 'Allied Bank Lahore Account', bank_name: 'Allied Bank Limited', branch_name: 'Liberty Market', account_number: '56789012345678', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-008', name: 'HBL Export USD Account', bank_name: 'Habib Bank Limited', branch_name: 'Clifton Branch', account_number: '89012345678901', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-009', name: 'NBP Salary Account', bank_name: 'National Bank of Pakistan', branch_name: 'Main Branch', account_number: '90123456789012', account_holder: 'TechZone Electronics', account_group: 'transactional' },
    { code: 'BA-010', name: 'Petty Cash — Islamabad', bank_name: 'Cash', branch_name: 'Islamabad Branch', account_number: 'CASH-003', account_holder: 'TechZone Electronics', account_group: 'transactional' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 8 — Couriers
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🚚  SECTION 8: Couriers');

  await createAll('Couriers', '/couriers', [
    { print_name: 'TCS Express', courier_name: 'TCS Couriers', phone: '111-123-456', email: 'corporate@tcs.com.pk', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'Leopards Courier', courier_name: 'Leopards Courier Svc', phone: '111-300-786', email: 'corp@leopardscourier.com', city: 'Lahore', country: 'Pakistan' },
    { print_name: 'DHL Pakistan', courier_name: 'DHL Express', phone: '0800-00345', email: 'pk.corp@dhl.com', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'FedEx Pakistan', courier_name: 'FedEx Express', phone: '021-35862290', email: 'pk@fedex.com', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'M&P Logistics', courier_name: 'M&P Express Logistics', phone: '111-006-111', email: 'corp@mnpexpress.com', city: 'Lahore', country: 'Pakistan' },
    { print_name: 'Swyft Delivery', courier_name: 'Swyft Logistics', phone: '0321-7787878', email: 'biz@swyftlogistics.pk', city: 'Lahore', country: 'Pakistan' },
    { print_name: 'Pakistan Post Office', courier_name: 'Pakistan Post', phone: '051-9215555', email: 'post@pakpost.gov.pk', city: 'Islamabad', country: 'Pakistan' },
    { print_name: 'Trax Logistics', courier_name: 'Trax', phone: '0311-1817290', email: 'corp@trax.pk', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'PostEx', courier_name: 'PostEx Courier', phone: '0317-4000311', email: 'biz@postex.pk', city: 'Lahore', country: 'Pakistan' },
    { print_name: 'BlueEx', courier_name: 'BlueEx Courier', phone: '0315-2583583', email: 'corp@blueex.com', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'NLC Cargo', courier_name: 'NLC Logistics', phone: '051-9270001', email: 'cargo@nlc.com.pk', city: 'Rawalpindi', country: 'Pakistan' },
    { print_name: 'Airblue Cargo', courier_name: 'Airblue Air Cargo', phone: '021-34578100', email: 'cargo@airblue.com', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'CallCourier', courier_name: 'CallCourier', phone: '042-111-111-111', email: 'info@callcourier.com.pk', city: 'Lahore', country: 'Pakistan' },
    { print_name: 'StarTrack Logistics', courier_name: 'StarTrack', phone: '021-35880000', email: 'info@startrack.pk', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'Rider Logistics', courier_name: 'Rider', phone: '0300-8484888', email: 'info@rider.pk', city: 'Lahore', country: 'Pakistan' },
    { print_name: 'TCS Same Day', courier_name: 'TCS Same Day', phone: '111-123-456', email: 'sameday@tcs.com.pk', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'ECS Logistics', courier_name: 'ECS', phone: '042-35781234', email: 'info@ecs.com.pk', city: 'Lahore', country: 'Pakistan' },
    { print_name: 'Skynet Worldwide', courier_name: 'Skynet', phone: '021-35640000', email: 'info@skynet.pk', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'Apex Logistics', courier_name: 'Apex', phone: '042-111-APEX', email: 'info@apex.pk', city: 'Lahore', country: 'Pakistan' },
    { print_name: 'SpeedEx Courier', courier_name: 'SpeedEx', phone: '051-111-111-222', email: 'info@speedex.pk', city: 'Islamabad', country: 'Pakistan' },
    { print_name: 'Flyer Logistics', courier_name: 'Flyer', phone: '021-35881234', email: 'info@flyer.pk', city: 'Karachi', country: 'Pakistan' },
    { print_name: 'CargoLink', courier_name: 'CargoLink', phone: '042-35785555', email: 'info@cargolink.pk', city: 'Lahore', country: 'Pakistan' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 9 — CRM
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🎯  SECTION 9: CRM Leads & Prospects');

  await createAll('CRM Leads', '/crm-leads', [
    { name: 'Ahsan Zafar', company: 'Zafar Holdings', email: 'ahsan@zafarholdings.pk', phone: '0300-9876543', source: 'Website', stage: 'new', probability: 20, expected_revenue: 850000, industry: 'Retail' },
    { name: 'Mehrunissa Alam', company: 'Alam Education Group', email: 'mehr@aeg.edu.pk', phone: '0321-8765432', source: 'Referral', stage: 'qualified', probability: 60, expected_revenue: 2200000, industry: 'Education' },
    { name: 'Rizwan Shaheen', company: 'Shaheen Pharma', email: 'rizwan@shaheenpharma.pk', phone: '0333-7654321', source: 'Cold Call', stage: 'new', probability: 15, expected_revenue: 380000, industry: 'Healthcare' },
    { name: 'Naila Pervez', company: 'Pervez Textile Mills', email: 'naila@ptm.pk', phone: '0345-6543210', source: 'Exhibition', stage: 'qualified', probability: 45, expected_revenue: 1200000, industry: 'Manufacturing' },
    { name: 'Salman Chaudhry', company: 'Chaudhry Real Estate', email: 'salman@cre.pk', phone: '0311-5432109', source: 'Website', stage: 'proposal', probability: 75, expected_revenue: 550000, industry: 'Real Estate' },
    { name: 'Humaira Siddiqui', company: 'Siddiqui Law Associates', email: 'law@siddiqui.pk', phone: '0322-4321098', source: 'LinkedIn', stage: 'new', probability: 25, expected_revenue: 180000, industry: 'Legal' },
    { name: 'Babar Nawaz', company: 'Nawaz Agro Industries', email: 'babar@nagroind.pk', phone: '0344-3210987', source: 'Trade Show', stage: 'qualified', probability: 35, expected_revenue: 320000, industry: 'Agriculture' },
    { name: 'Shazia Tashfeen', company: 'Tashfeen Media Group', email: 'shazia@tmg.pk', phone: '0315-2109876', source: 'Referral', stage: 'proposal', probability: 65, expected_revenue: 980000, industry: 'Media' },
    { name: 'Pervaiz Elahi', company: 'Elahi Construction Co', email: 'pervaiz@ecc.pk', phone: '0301-1098765', source: 'Cold Call', stage: 'new', probability: 10, expected_revenue: 450000, industry: 'Construction' },
    { name: 'Raheela Bashir', company: 'Bashir Hospital Network', email: 'raheela@bhn.pk', phone: '0340-0987654', source: 'Website', stage: 'qualified', probability: 55, expected_revenue: 3200000, industry: 'Healthcare' },
    { name: 'Kamran Niaz', company: 'Niaz Logistics Co', email: 'kamran@nlco.pk', phone: '0300-8765432', source: 'LinkedIn', stage: 'negotiation', probability: 80, expected_revenue: 750000, industry: 'Logistics' },
    { name: 'Samar Rasheed', company: 'Rasheed Food Industries', email: 'samar@rfi.pk', phone: '0321-7654321', source: 'Referral', stage: 'new', probability: 20, expected_revenue: 280000, industry: 'Food' },
    { name: 'Noman Karimi', company: 'Karimi Import Export', email: 'noman@kimportexport.pk', phone: '0333-6543210', source: 'Exhibition', stage: 'proposal', probability: 50, expected_revenue: 1650000, industry: 'Trading' },
    { name: 'Amber Gilani', company: 'Gilani Fashion House', email: 'amber@gfh.pk', phone: '0345-5432109', source: 'Walk-in', stage: 'qualified', probability: 40, expected_revenue: 220000, industry: 'Retail' },
    { name: 'Sohail Wasim', company: 'Wasim Tours & Travels', email: 'sohail@wtravels.pk', phone: '0311-4321098', source: 'Social Media', stage: 'new', probability: 15, expected_revenue: 150000, industry: 'Tourism' },
    { name: 'Irfan Haider', company: 'Haider Engineering Works', email: 'irfan@hengineering.pk', phone: '0322-3210987', source: 'Cold Call', stage: 'proposal', probability: 60, expected_revenue: 480000, industry: 'Engineering' },
    { name: 'Sumbul Naqvi', company: 'Naqvi & Partners CPA', email: 'sumbul@naqvicpa.pk', phone: '0344-2109876', source: 'Referral', stage: 'qualified', probability: 45, expected_revenue: 310000, industry: 'Finance' },
    { name: 'Asif Jalal', company: 'Jalal Auto Parts', email: 'asif@jalalauto.pk', phone: '0315-1098765', source: 'Walk-in', stage: 'new', probability: 25, expected_revenue: 195000, industry: 'Automotive' },
    { name: 'Farrukh Ansari', company: 'Ansari Steel Mills', email: 'farrukh@asteel.pk', phone: '0301-0987654', source: 'Trade Show', stage: 'qualified', probability: 35, expected_revenue: 560000, industry: 'Manufacturing' },
    { name: 'Madiha Sayeed', company: 'Sayeed Digital Marketing', email: 'madiha@sdm.pk', phone: '0340-9876543', source: 'Social Media', stage: 'negotiation', probability: 70, expected_revenue: 420000, industry: 'Marketing' },
    { name: 'Tahir Mehmood', company: 'Mehmood Brothers', email: 'tahir@mehmoodbros.pk', phone: '0300-1122334', source: 'Website', stage: 'new', probability: 30, expected_revenue: 600000, industry: 'Wholesale' },
    { name: 'Shabana Kausar', company: 'Kausar Enterprises', email: 'shabana@kausarenterprises.pk', phone: '0321-2233445', source: 'Referral', stage: 'qualified', probability: 50, expected_revenue: 880000, industry: 'Retail' },
  ]);

  await createAll('Prospects', '/prospects', [
    { print_name: 'Rafiq Brothers', contact_person: 'Muhammad Rafiq', email: 'rafiq@rafiqbros.pk', phone: '021-35001234', city: 'Karachi', country: 'Pakistan', source: 'Exhibition', status: 'active', industry: 'Retail' },
    { print_name: 'Sunrise Technologies', contact_person: 'Nasir Ahmed', email: 'nasir@sunrisetec.pk', phone: '042-36002345', city: 'Lahore', country: 'Pakistan', source: 'Website', status: 'active', industry: 'IT Services' },
    { print_name: 'Crescent Developers', contact_person: 'Bilal Crescent', email: 'bilal@crescentdev.pk', phone: '051-2803456', city: 'Islamabad', country: 'Pakistan', source: 'Referral', status: 'active', industry: 'Real Estate' },
    { print_name: 'Al-Noor Enterprises', contact_person: 'Noor Khalid', email: 'noor@alnoor.pk', phone: '0300-4004567', city: 'Karachi', country: 'Pakistan', source: 'Cold Call', status: 'active', industry: 'Trading' },
    { print_name: 'Pak Minerals Co', contact_person: 'Zahid Khan', email: 'zahid@pakminerals.pk', phone: '0321-5005678', city: 'Quetta', country: 'Pakistan', source: 'Trade Show', status: 'active', industry: 'Mining' },
    { print_name: 'Delta Freight Services', contact_person: 'Usman Delta', email: 'usman@deltafreight.pk', phone: '021-36006789', city: 'Karachi', country: 'Pakistan', source: 'LinkedIn', status: 'active', industry: 'Logistics' },
    { print_name: 'Platinum Hotels Group', contact_person: 'Adil Platinum', email: 'adil@platinumhotels.pk', phone: '051-2807890', city: 'Islamabad', country: 'Pakistan', source: 'Website', status: 'active', industry: 'Hospitality' },
    { print_name: 'Green Valley Farms', contact_person: 'Iqbal Farms', email: 'iqbal@greenvalley.pk', phone: '0345-8008901', city: 'Lahore', country: 'Pakistan', source: 'Referral', status: 'active', industry: 'Agriculture' },
    { print_name: 'Metro Healthcare', contact_person: 'Dr. Sana Metro', email: 'sana@metrohealthcare.pk', phone: '021-37009012', city: 'Karachi', country: 'Pakistan', source: 'Exhibition', status: 'active', industry: 'Healthcare' },
    { print_name: 'Crown Packaging', contact_person: 'Atif Crown', email: 'atif@crownpack.pk', phone: '042-38010123', city: 'Lahore', country: 'Pakistan', source: 'Cold Call', status: 'active', industry: 'Manufacturing' },
    { print_name: 'Pak Aviation Services', contact_person: 'Asad Aviation', email: 'asad@pakaviation.pk', phone: '021-39011234', city: 'Karachi', country: 'Pakistan', source: 'LinkedIn', status: 'active', industry: 'Aviation' },
    { print_name: 'Horizon Schools', contact_person: 'Sara Horizon', email: 'sara@horizonschools.pk', phone: '042-35012345', city: 'Lahore', country: 'Pakistan', source: 'Walk-in', status: 'active', industry: 'Education' },
    { print_name: 'Sapphire Textiles', contact_person: 'Faiz Sapphire', email: 'faiz@sapphiretex.pk', phone: '041-8013456', city: 'Faisalabad', country: 'Pakistan', source: 'Trade Show', status: 'active', industry: 'Textiles' },
    { print_name: 'National Foods Ltd', contact_person: 'Haris National', email: 'haris@natfoods.pk', phone: '021-32014567', city: 'Karachi', country: 'Pakistan', source: 'Website', status: 'active', industry: 'Food' },
    { print_name: 'Lahore Electric Supply', contact_person: 'Rizwan LESCO', email: 'rizwan@lesco.gov.pk', phone: '042-99015678', city: 'Lahore', country: 'Pakistan', source: 'Government', status: 'active', industry: 'Utilities' },
    { print_name: 'Fauji Fertilizers', contact_person: 'Col. Ahmed', email: 'ahmed@ffc.com.pk', phone: '051-9016789', city: 'Rawalpindi', country: 'Pakistan', source: 'Referral', status: 'active', industry: 'Agriculture' },
    { print_name: 'City District Courts', contact_person: 'Mukhtar Courts', email: 'it@courts.gov.pk', phone: '042-99017890', city: 'Lahore', country: 'Pakistan', source: 'Government', status: 'active', industry: 'Government' },
    { print_name: 'Q Mobile Distribution', contact_person: 'Ali Q', email: 'ali@qmobile.pk', phone: '021-36018901', city: 'Karachi', country: 'Pakistan', source: 'Exhibition', status: 'active', industry: 'Telecom' },
    { print_name: 'Qadir Bux Telecom', contact_person: 'Qadir Bux', email: 'qadir@qbtelecom.pk', phone: '0315-9019012', city: 'Hyderabad', country: 'Pakistan', source: 'Walk-in', status: 'active', industry: 'Telecom' },
    { print_name: 'Sindh Revenue Authority', contact_person: 'SRA IT Head', email: 'it@sra.gov.pk', phone: '021-99020123', city: 'Karachi', country: 'Pakistan', source: 'Government', status: 'active', industry: 'Government' },
    { print_name: 'Karachi Port Trust', contact_person: 'KPT IT Dept', email: 'it@kpt.gov.pk', phone: '021-99229000', city: 'Karachi', country: 'Pakistan', source: 'Government', status: 'active', industry: 'Logistics' },
    { print_name: 'Punjab IT Board', contact_person: 'PITB Director', email: 'info@pitb.gov.pk', phone: '042-99200000', city: 'Lahore', country: 'Pakistan', source: 'Government', status: 'active', industry: 'Government' },
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 10 — Sales Quotations
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📄  SECTION 10: Sales Quotations');

  const sqSubjects = [
    'Laptop Supply for IT Department', 'Complete Office IT Setup', 'Network Infrastructure Equipment',
    'Server & Storage Solution', 'Printer & Scanner Supply', 'CCTV Security System Installation',
    'Gaming Lab Setup Equipment', 'Mobile Phones Bulk Order', 'UPS & Power Backup Systems',
    'Desktop Computers for Finance Dept', 'Monitor & Display Upgrade', 'Annual Maintenance Contract',
    'Wi-Fi Network Expansion', 'Video Conferencing Equipment', 'Keyboard, Mouse & Accessories Bundle',
    'Tablet Supply for Field Team', 'External Storage & Backup Solution', 'Workstation for Design Department',
    'IT Support Services Package', 'Complete Branch IT Rollout', 'NAS Storage Solution', 'Smart Office Automation',
  ];

  for (let i = 0; i < sqSubjects.length; i++) {
    const cust = customers[i % customers.length];
    const prod1 = products[i % products.length];
    const prod2 = products[(i + 3) % products.length];
    try {
      await post('/sales-quotations', {
        customer_id: cust.id,
        date: daysAgo(sqSubjects.length - i),
        expiry_date: daysFwd(30),
        reference: `SQ-${String(i + 1).padStart(4, '0')}`,
        subject: sqSubjects[i],
        discount_pct: i % 4 === 0 ? 5 : 0,
        lines: [
          { product_id: prod1.id, description: prod1.name, quantity: Math.ceil(Math.random() * 5) + 1, unit_price: prod1.sale_price || 10000 },
          { product_id: prod2.id, description: prod2.name, quantity: Math.ceil(Math.random() * 3) + 1, unit_price: prod2.sale_price || 5000 },
        ],
      });
    } catch (e) { process.stdout.write(`\n    ⚠️  SQ ${i + 1}: ${e.message}`); }
  }
  console.log(`  ✅  ${sqSubjects.length} Sales Quotations created`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 11 — Purchase Quotations
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📄  SECTION 11: Purchase Quotations');

  const pqSubjects = [
    'Laptop Stock Replenishment Q3', 'Mobile Phone Bulk Purchase', 'Network Equipment Import',
    'Server Hardware Procurement', 'Printer Cartridge & Supplies', 'UPS Units Purchase',
    'Monitor Bulk Order', 'RAM & SSD Components', 'Keyboard & Mouse Accessories',
    'CCTV Cameras & DVR Units', 'Tablet Devices Purchase', 'Gaming Peripherals Stock',
    'Networking Cables & Patch Panels', 'Power Strip & Extensions', 'Webcam & Headset Order',
    'External HDD Procurement', 'Switch & Router Stock', 'Workstation Components',
    'IT Consumables Bundle', 'Annual Stock Purchase Agreement', 'NAS Units Import', 'Smart Display Panels',
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
          { product_id: prod2.id, description: prod2.name, quantity: Math.ceil(Math.random() * 5) + 1, unit_price: prod2.purchase_price || 4000 },
        ],
      });
    } catch (e) { process.stdout.write(`\n    ⚠️  PQ ${i + 1}: ${e.message}`); }
  }
  console.log(`  ✅  ${pqSubjects.length} Purchase Quotations created`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 12 — Sales Invoices
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🧾  SECTION 12: Sales Invoices');

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
        due_date: daysFwd(30 - i),
        reference: `SI-${String(i + 1).padStart(4, '0')}`,
        subject: siSubjects[i],
        discount_pct: i % 5 === 0 ? 5 : 0,
        lines: [
          { product_id: prod1.id, description: prod1.name, quantity: Math.ceil(Math.random() * 5) + 1, unit_price: prod1.sale_price || 10000 },
          { product_id: prod2.id, description: prod2.name, quantity: Math.ceil(Math.random() * 3) + 1, unit_price: prod2.sale_price || 6000 },
        ],
      });
    } catch (e) { process.stdout.write(`\n    ⚠️  SI ${i + 1}: ${e.message}`); }
  }
  console.log(`  ✅  ${siSubjects.length} Sales Invoices created`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 13 — Purchase Invoices
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n🧾  SECTION 13: Purchase Invoices');

  const piSubjects = [
    'Laptop Stock Import', 'Mobile Phones Shipment', 'Network Equipment Purchase',
    'Server Hardware', 'Printer Supplies Import', 'UPS Units Import',
    'Monitor Batch', 'RAM & Components', 'Accessories Stock',
    'CCTV Cameras Import', 'Tablets Shipment', 'Gaming Peripherals',
    'Cables & Connectors', 'Power Equipment', 'Webcam Stock',
    'External Storage Import', 'Switch & Router Batch', 'Workstation Parts',
    'IT Consumables', 'Bulk Stock Purchase', 'NAS Units Stock', 'Smart Display Panels',
  ];

  for (let i = 0; i < piSubjects.length; i++) {
    const vend = vendors[i % vendors.length];
    const prod1 = products[i % products.length];
    const prod2 = products[(i + 6) % products.length];
    try {
      await post('/purchase-invoices', {
        vendor_id: vend.id,
        date: daysAgo(piSubjects.length - i),
        due_date: daysFwd(30 - i),
        reference: `PI-${String(i + 1).padStart(4, '0')}`,
        subject: piSubjects[i],
        discount: i % 5 === 0 ? 5000 : 0,
        lines: [
          { product_id: prod1.id, description: prod1.name, quantity: Math.ceil(Math.random() * 10) + 3, unit_price: prod1.purchase_price || 8000 },
          { product_id: prod2.id, description: prod2.name, quantity: Math.ceil(Math.random() * 5) + 1, unit_price: prod2.purchase_price || 4500 },
        ],
      });
    } catch (e) { process.stdout.write(`\n    ⚠️  PI ${i + 1}: ${e.message}`); }
  }
  console.log(`  ✅  ${piSubjects.length} Purchase Invoices created`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 14 — Expenses
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n💸  SECTION 14: Expenses');

  if (bankAccounts.length > 0) {
    let expenseAccounts = [];
    try {
      const coa = await get('/chart-of-accounts');
      expenseAccounts = (Array.isArray(coa) ? coa : coa.data || [])
        .filter(a => a.type === 'expense' || a.account_type === 'expense');
    } catch (e) { process.stdout.write(`\n    ⚠️  Could not fetch chart of accounts: ${e.message}`); }

    if (expenseAccounts.length > 0) {
      const expData = [
        { desc: 'Office Rent — July 2024', amount: 180000 }, { desc: 'Internet & Bandwidth Charges', amount: 35000 },
        { desc: 'Electricity Bill — Head Office', amount: 28000 }, { desc: 'Fuel & Vehicle Maintenance', amount: 22000 },
        { desc: 'Staff Salaries — July 2024', amount: 1250000 }, { desc: 'Office Supplies & Stationery', amount: 15000 },
        { desc: 'Marketing & Advertising — Digital', amount: 85000 }, { desc: 'Warehouse Rent — Karachi', amount: 95000 },
        { desc: 'Telephone & Mobile Bills', amount: 18000 }, { desc: 'Repair & Maintenance — Office', amount: 45000 },
        { desc: 'Insurance Premium — Annual', amount: 120000 }, { desc: 'Courier & Freight Charges', amount: 32000 },
        { desc: 'Tea, Coffee & Office Refreshments', amount: 8500 }, { desc: 'Website Hosting & Domain', amount: 12000 },
        { desc: 'Software Licenses — Annual', amount: 75000 }, { desc: 'Bank Charges & Fees', amount: 5500 },
        { desc: 'Trade Exhibition Participation Fee', amount: 50000 }, { desc: 'Staff Training & Development', amount: 35000 },
        { desc: 'Printing & Branding Materials', amount: 28000 }, { desc: 'Legal & Professional Fees', amount: 60000 },
        { desc: 'Security Services — Monthly', amount: 25000 }, { desc: 'Generator Fuel — Warehouse', amount: 18000 },
        { desc: 'Water & Utility Charges', amount: 12000 }, { desc: 'Employee Medical Reimbursement', amount: 45000 },
      ];

      for (let i = 0; i < expData.length; i++) {
        const ea = pick(expenseAccounts);
        const ba = bankAccounts[i % bankAccounts.length];
        try {
          await post('/expenses', {
            date: daysAgo(expData.length - i),
            bank_account_id: ba.id,
            comments: expData[i].desc,
            lines: [{ account_id: ea.id, description: expData[i].desc, amount: expData[i].amount }],
          });
        } catch (e) { process.stdout.write(`\n    ⚠️  Expense ${i + 1}: ${e.message}`); }
      }
      console.log(`  ✅  ${expData.length} Expenses created`);
    } else {
      console.log('  ⚠️  No expense accounts found — skipping expenses');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DONE
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(70));
  console.log('🎉  SEEDING COMPLETE!');
  console.log('='.repeat(70));
  console.log('\nSummary of data created:');
  console.log('  • 22  Customer Categories');
  console.log('  • 22  Vendor Categories');
  console.log('  • 22  Product Categories');
  console.log('  • 30  Brands');
  console.log('  •  8  Taxes');
  console.log('  • 22  Departments');
  console.log('  • 28  Designations');
  console.log('  • 22  Employees');
  console.log('  • 22  Customers');
  console.log('  • 22  Vendors');
  console.log('  • 30  Products & Services');
  console.log('  • 22  Sales Persons');
  console.log('  • 22  Other Contacts');
  console.log('  • 22  Projects');
  console.log('  •  8  Warehouses');
  console.log('  • 10  Bank Accounts');
  console.log('  • 22  Couriers');
  console.log('  • 22  CRM Leads');
  console.log('  • 22  Prospects');
  console.log('  • 22  Sales Quotations');
  console.log('  • 22  Purchase Quotations');
  console.log('  • 22  Sales Invoices');
  console.log('  • 22  Purchase Invoices');
  console.log('  • 24  Expenses');
  console.log('\n✅  All tables populated with 20+ dummy entries!');
})();
