'use strict';
const BASE     = 'http://localhost:3001/api';
const COMPANY  = 'techzone-demo-2024';
const USER_ID  = 'admin';
const PASSWORD = '123456';

let TOKEN = '';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      'X-Company-ID':  COMPANY,
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
const get  = (p)    => request('GET',  p);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

(async () => {
  console.log('🔐  Logging in…');
  const auth = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: USER_ID, password: PASSWORD }),
  });
  TOKEN = (await auth.json()).token;
  console.log('✅  Logged in\n');

  // Fetch existing departments/designations for employee linking
  const existingDepts = await get('/departments').catch(() => []);
  const existingDesigs = await get('/designations').catch(() => []);

  // ── Departments ────────────────────────────────────────────────────────────
  process.stdout.write('Departments… ');
  let ok = 0, total = 0;
  const deptNames = [
    'Sales & Marketing', 'Information Technology', 'Human Resources',
    'Finance & Accounts', 'Operations', 'Warehouse & Logistics',
    'Customer Support', 'Procurement', 'Administration',
  ];
  const departments = [];
  for (const name of deptNames) {
    total++;
    // check if already exists
    const found = existingDepts.find(d => d.name === name);
    if (found) { departments.push(found); ok++; continue; }
    try {
      const r = await post('/departments', { name });
      departments.push(r);
      ok++;
    } catch(e) { process.stdout.write(`\n  ⚠️  ${e.message}`); }
  }
  console.log(`✅ ${ok}/${total}`);

  // ── Designations ───────────────────────────────────────────────────────────
  process.stdout.write('Designations… ');
  ok = 0; total = 0;
  const desigNames = [
    'Chief Executive Officer', 'General Manager', 'Department Manager',
    'Senior Sales Executive', 'Sales Executive', 'IT Engineer',
    'HR Officer', 'Accounts Officer', 'Warehouse Supervisor',
    'Customer Service Representative', 'Procurement Officer',
    'Marketing Specialist', 'System Administrator', 'Accountant',
  ];
  const designations = [];
  for (const name of desigNames) {
    total++;
    const found = existingDesigs.find(d => d.name === name);
    if (found) { designations.push(found); ok++; continue; }
    try {
      const r = await post('/designations', { name });
      designations.push(r);
      ok++;
    } catch(e) { process.stdout.write(`\n  ⚠️  ${e.message}`); }
  }
  console.log(`✅ ${ok}/${total}`);

  // ── Employees ──────────────────────────────────────────────────────────────
  process.stdout.write('Employees… ');
  ok = 0; total = 0;
  const employeeData = [
    { name: 'Ali Hassan Malik',  phone: '0300-1111111', email: 'ali.malik@techzone.pk',      salary: 250000, cnic: '42101-1234567-1', join_date: '2020-01-05' },
    { name: 'Fatima Zahra Khan', phone: '0321-2222222', email: 'fatima.khan@techzone.pk',    salary: 180000, cnic: '42201-2345678-2', join_date: '2020-03-15' },
    { name: 'Muhammad Usman',    phone: '0333-3333333', email: 'm.usman@techzone.pk',        salary: 120000, cnic: '35201-3456789-3', join_date: '2020-06-01' },
    { name: 'Sara Ahmed',        phone: '0345-4444444', email: 'sara.ahmed@techzone.pk',     salary: 95000,  cnic: '35202-4567890-4', join_date: '2021-01-10' },
    { name: 'Bilal Raza',        phone: '0311-5555555', email: 'bilal.raza@techzone.pk',     salary: 110000, cnic: '42301-5678901-5', join_date: '2021-02-20' },
    { name: 'Ayesha Tariq',      phone: '0322-6666666', email: 'ayesha.tariq@techzone.pk',   salary: 85000,  cnic: '42401-6789012-6', join_date: '2021-04-01' },
    { name: 'Kamran Sheikh',     phone: '0344-7777777', email: 'kamran.sheikh@techzone.pk',  salary: 130000, cnic: '42501-7890123-7', join_date: '2021-05-15' },
    { name: 'Nadia Iqbal',       phone: '0315-8888888', email: 'nadia.iqbal@techzone.pk',    salary: 75000,  cnic: '42601-8901234-8', join_date: '2021-07-01' },
    { name: 'Tariq Mehmood',     phone: '0301-9999999', email: 'tariq.mehmood@techzone.pk',  salary: 145000, cnic: '42701-9012345-9', join_date: '2021-09-10' },
    { name: 'Zainab Hussain',    phone: '0340-1234560', email: 'zainab.hussain@techzone.pk', salary: 90000,  cnic: '42801-0123456-0', join_date: '2021-11-01' },
    { name: 'Omar Farooq',       phone: '0300-2233445', email: 'omar.farooq@techzone.pk',    salary: 165000, cnic: '42101-1234568-1', join_date: '2022-01-15' },
    { name: 'Sana Butt',         phone: '0321-3344556', email: 'sana.butt@techzone.pk',      salary: 70000,  cnic: '42201-2345679-2', join_date: '2022-03-01' },
    { name: 'Hassan Ali',        phone: '0333-4455667', email: 'hassan.ali@techzone.pk',     salary: 105000, cnic: '35201-3456780-3', join_date: '2022-04-20' },
    { name: 'Maria Javed',       phone: '0345-5566778', email: 'maria.javed@techzone.pk',    salary: 88000,  cnic: '35202-4567891-4', join_date: '2022-06-01' },
    { name: 'Adnan Qureshi',     phone: '0311-6677889', email: 'adnan.qureshi@techzone.pk',  salary: 125000, cnic: '42301-5678902-5', join_date: '2022-08-10' },
    { name: 'Rabia Nadeem',      phone: '0322-7788990', email: 'rabia.nadeem@techzone.pk',   salary: 78000,  cnic: '42401-6789013-6', join_date: '2022-10-01' },
    { name: 'Faisal Sultan',     phone: '0344-8899001', email: 'faisal.sultan@techzone.pk',  salary: 195000, cnic: '42501-7890124-7', join_date: '2023-01-05' },
    { name: 'Hina Baig',         phone: '0315-9900112', email: 'hina.baig@techzone.pk',      salary: 65000,  cnic: '42601-8901235-8', join_date: '2023-03-15' },
    { name: 'Waseem Akhtar',     phone: '0301-0011223', email: 'waseem.akhtar@techzone.pk',  salary: 115000, cnic: '42701-9012346-9', join_date: '2023-05-01' },
    { name: 'Saima Perveen',     phone: '0340-1122334', email: 'saima.perveen@techzone.pk',  salary: 82000,  cnic: '42801-0123457-0', join_date: '2023-07-10' },
  ];
  for (const e of employeeData) {
    total++;
    try {
      await post('/employees', {
        ...e,
        department_id:  pick(departments)?.id || null,
        designation_id: pick(designations)?.id || null,
        is_active: true,
      });
      ok++;
    } catch(err) { process.stdout.write(`\n  ⚠️  ${err.message}`); }
  }
  console.log(`✅ ${ok}/${total}`);

  // ── Sales Persons ──────────────────────────────────────────────────────────
  process.stdout.write('Sales Persons… ');
  ok = 0; total = 0;
  const salesPersons = [
    { print_name:'Zubair Ahmed',   phone:'0300-1010101', email:'zubair@techzone.pk',  type:'salesman', can_add_discount:true  },
    { print_name:'Amna Khalid',    phone:'0321-2020202', email:'amna@techzone.pk',    type:'salesman', can_add_discount:false },
    { print_name:'Shahzad Mirza',  phone:'0333-3030303', email:'shahzad@techzone.pk', type:'salesman', can_add_discount:true  },
    { print_name:'Lubna Malik',    phone:'0345-4040404', email:'lubna@techzone.pk',   type:'salesman', can_add_discount:false },
    { print_name:'Aamir Siddiqui', phone:'0311-5050505', email:'aamir@techzone.pk',   type:'salesman', can_add_discount:true  },
    { print_name:'Qasim Hassan',   phone:'0322-6060606', email:'qasim@techzone.pk',   type:'salesman', can_add_discount:true  },
    { print_name:'Sadia Rizvi',    phone:'0344-7070707', email:'sadia@techzone.pk',   type:'salesman', can_add_discount:false },
    { print_name:'Imran Baig',     phone:'0315-8080808', email:'imran@techzone.pk',   type:'salesman', can_add_discount:true  },
    { print_name:'Kiran Afzal',    phone:'0301-9090909', email:'kiran@techzone.pk',   type:'salesman', can_add_discount:false },
    { print_name:'Naeem Chaudhry', phone:'0340-1212121', email:'naeem@techzone.pk',   type:'salesman', can_add_discount:true  },
    { print_name:'Uzma Rehman',    phone:'0300-2323232', email:'uzma@techzone.pk',    type:'salesman', can_add_discount:false },
    { print_name:'Tariq Gill',     phone:'0321-3434343', email:'tariq.g@techzone.pk', type:'salesman', can_add_discount:true  },
    { print_name:'Aroha Shafiq',   phone:'0333-4545454', email:'aroha@techzone.pk',   type:'salesman', can_add_discount:false },
    { print_name:'Danish Aslam',   phone:'0345-5656565', email:'danish@techzone.pk',  type:'salesman', can_add_discount:true  },
    { print_name:'Mehwish Noor',   phone:'0311-6767676', email:'mehwish@techzone.pk', type:'salesman', can_add_discount:false },
    { print_name:'Umar Sajid',     phone:'0322-7878787', email:'umar@techzone.pk',    type:'salesman', can_add_discount:true  },
    { print_name:'Fariha Zaidi',   phone:'0344-8989898', email:'fariha@techzone.pk',  type:'salesman', can_add_discount:false },
    { print_name:'Saad Farhan',    phone:'0315-9090901', email:'saad.f@techzone.pk',  type:'salesman', can_add_discount:true  },
    { print_name:'Humaira Ghani',  phone:'0301-0101010', email:'humaira@techzone.pk', type:'salesman', can_add_discount:false },
    { print_name:'Junaid Akram',   phone:'0340-1212120', email:'junaid@techzone.pk',  type:'salesman', can_add_discount:true  },
  ];
  for (const sp of salesPersons) {
    total++;
    try { await post('/sales-persons', sp); ok++; }
    catch(e) { process.stdout.write(`\n  ⚠️  ${e.message}`); }
  }
  console.log(`✅ ${ok}/${total}`);

  // ── Prospects ──────────────────────────────────────────────────────────────
  process.stdout.write('Prospects… ');
  ok = 0; total = 0;
  const prospectData = [
    { print_name:'Rafiq Brothers',          contact_person:'Muhammad Rafiq', email:'rafiq@rafiqbros.pk',       phone:'021-35001234', city:'Karachi',    country:'Pakistan', source:'Exhibition',  status:'active', industry:'Retail'       },
    { print_name:'Sunrise Technologies',    contact_person:'Nasir Ahmed',    email:'nasir@sunrisetec.pk',      phone:'042-36002345', city:'Lahore',     country:'Pakistan', source:'Website',     status:'active', industry:'IT Services'  },
    { print_name:'Crescent Developers',     contact_person:'Bilal Crescent', email:'bilal@crescentdev.pk',    phone:'051-2803456',  city:'Islamabad',  country:'Pakistan', source:'Referral',    status:'active', industry:'Real Estate'  },
    { print_name:'Al-Noor Enterprises',     contact_person:'Noor Khalid',    email:'noor@alnoor.pk',           phone:'0300-4004567', city:'Karachi',    country:'Pakistan', source:'Cold Call',   status:'active', industry:'Trading'      },
    { print_name:'Pak Minerals Co',         contact_person:'Zahid Khan',     email:'zahid@pakminerals.pk',     phone:'0321-5005678', city:'Quetta',     country:'Pakistan', source:'Trade Show',  status:'active', industry:'Mining'       },
    { print_name:'Delta Freight Services',  contact_person:'Usman Delta',    email:'usman@deltafreight.pk',    phone:'021-36006789', city:'Karachi',    country:'Pakistan', source:'LinkedIn',    status:'active', industry:'Logistics'    },
    { print_name:'Platinum Hotels Group',   contact_person:'Adil Platinum',  email:'adil@platinumhotels.pk',  phone:'051-2807890',  city:'Islamabad',  country:'Pakistan', source:'Website',     status:'active', industry:'Hospitality'  },
    { print_name:'Green Valley Farms',      contact_person:'Iqbal Farms',    email:'iqbal@greenvalley.pk',     phone:'0345-8008901', city:'Lahore',     country:'Pakistan', source:'Referral',    status:'active', industry:'Agriculture'  },
    { print_name:'Metro Healthcare',        contact_person:'Dr. Sana Metro', email:'sana@metrohealthcare.pk',  phone:'021-37009012', city:'Karachi',    country:'Pakistan', source:'Exhibition',  status:'active', industry:'Healthcare'   },
    { print_name:'Crown Packaging',         contact_person:'Atif Crown',     email:'atif@crownpack.pk',        phone:'042-38010123', city:'Lahore',     country:'Pakistan', source:'Cold Call',   status:'active', industry:'Manufacturing'},
    { print_name:'Pak Aviation Services',   contact_person:'Asad Aviation',  email:'asad@pakaviation.pk',      phone:'021-39011234', city:'Karachi',    country:'Pakistan', source:'LinkedIn',    status:'active', industry:'Aviation'     },
    { print_name:'Horizon Schools',         contact_person:'Sara Horizon',   email:'sara@horizonschools.pk',   phone:'042-35012345', city:'Lahore',     country:'Pakistan', source:'Walk-in',     status:'active', industry:'Education'    },
    { print_name:'Sapphire Textiles',       contact_person:'Faiz Sapphire',  email:'faiz@sapphiretex.pk',      phone:'041-8013456',  city:'Faisalabad', country:'Pakistan', source:'Trade Show',  status:'active', industry:'Textiles'     },
    { print_name:'National Foods Ltd',      contact_person:'Haris National', email:'haris@natfoods.pk',        phone:'021-32014567', city:'Karachi',    country:'Pakistan', source:'Website',     status:'active', industry:'Food'         },
    { print_name:'Lahore Electric Supply',  contact_person:'Rizwan LESCO',   email:'rizwan@lesco.gov.pk',      phone:'042-99015678', city:'Lahore',     country:'Pakistan', source:'Government',  status:'active', industry:'Utilities'    },
    { print_name:'Fauji Fertilizers',       contact_person:'Col. Ahmed',     email:'ahmed@ffc.com.pk',         phone:'051-9016789',  city:'Rawalpindi', country:'Pakistan', source:'Referral',    status:'active', industry:'Agriculture'  },
    { print_name:'City District Courts',    contact_person:'Mukhtar Courts', email:'it@courts.gov.pk',         phone:'042-99017890', city:'Lahore',     country:'Pakistan', source:'Government',  status:'active', industry:'Government'   },
    { print_name:'Q Mobile Distribution',   contact_person:'Ali Q',          email:'ali@qmobile.pk',           phone:'021-36018901', city:'Karachi',    country:'Pakistan', source:'Exhibition',  status:'active', industry:'Telecom'      },
    { print_name:'Qadir Bux Telecom',       contact_person:'Qadir Bux',      email:'qadir@qbtelecom.pk',       phone:'0315-9019012', city:'Hyderabad',  country:'Pakistan', source:'Walk-in',     status:'active', industry:'Telecom'      },
    { print_name:'Sindh Revenue Authority', contact_person:'SRA IT Head',    email:'it@sra.gov.pk',            phone:'021-99020123', city:'Karachi',    country:'Pakistan', source:'Government',  status:'active', industry:'Government'   },
  ];
  for (const p of prospectData) {
    total++;
    try { await post('/prospects', p); ok++; }
    catch(e) { process.stdout.write(`\n  ⚠️  ${e.message}`); }
  }
  console.log(`✅ ${ok}/${total}`);

  console.log('\n🎉  All failed sections re-seeded!');
})();
