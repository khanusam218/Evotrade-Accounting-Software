const http = require('http');

const BASE_URL = 'http://localhost:3001';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Running Evotrade App Tests\n');

  // Test 1: API Health
  console.log('Test 1: API Health Check');
  let result = await makeRequest('GET', '/api/health');
  console.log(`✓ Status: ${result.status}`);
  console.log(`✓ Response: ${JSON.stringify(result.body)}\n`);

  // Test 2: Create first user
  console.log('Test 2: Signup First User (testuser1)');
  result = await makeRequest('POST', '/api/auth/signup', {
    id: 'testuser1',
    password: 'password123',
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response: ${JSON.stringify(result.body)}`);
  const user1Created = result.status === 201 || result.status === 200;
  console.log(`✓ User created: ${user1Created}\n`);

  // Test 3: Login with first user
  console.log('Test 3: Login First User (testuser1)');
  result = await makeRequest('POST', '/api/auth/login', {
    id: 'testuser1',
    password: 'password123',
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response: ${JSON.stringify(result.body)}`);
  console.log(`✓ Login successful: ${result.status === 200}\n`);

  // Test 4: Create second user
  console.log('Test 4: Signup Second User (testuser2)');
  result = await makeRequest('POST', '/api/auth/signup', {
    id: 'testuser2',
    password: 'password456',
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response: ${JSON.stringify(result.body)}`);
  const user2Created = result.status === 201 || result.status === 200;
  console.log(`✓ User created: ${user2Created}\n`);

  // Test 5: Verify Chart of Accounts endpoint exists
  console.log('Test 5: Chart of Accounts API (with X-Company-ID header)');
  result = await makeRequest('GET', '/api/chart-of-accounts', null, {
    'X-Company-ID': 'test-company-1',
  });
  console.log(`Status: ${result.status}`);
  console.log(`Response type: ${typeof result.body}`);
  if (Array.isArray(result.body)) {
    console.log(`✓ Accounts returned: ${result.body.length} accounts`);
    if (result.body.length > 0) {
      console.log(`Sample account: ${JSON.stringify(result.body[0], null, 2)}`);
    }
  } else {
    console.log(`Response: ${JSON.stringify(result.body)}`);
  }
  console.log();

  // Test 6: Frontend availability
  console.log('Test 6: Frontend Server Check');
  result = await new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5173,
      path: '/',
      method: 'GET',
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data.slice(0, 100),
        });
      });
    });
    req.on('error', () => resolve({ status: 0, body: 'Connection failed' }));
    req.end();
  });
  console.log(`Status: ${result.status}`);
  console.log(`✓ Frontend is ${result.status === 200 ? 'running' : 'not responding'}\n`);

  console.log('✅ Test suite completed!');
  console.log('\nNext: Open http://localhost:5173 in your browser to test UI features:');
  console.log('1. Signup with multiple users');
  console.log('2. Verify button colors are blue');
  console.log('3. Verify each user has isolated businesses');
  console.log('4. Test logout form clearing');
}

runTests().catch(console.error);
