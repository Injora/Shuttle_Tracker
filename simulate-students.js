const { execSync } = require('child_process');

const API_URL = 'http://localhost:5001';
async function loginUser(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Login failed for ${email}: ${errorText}`);
  }
  const data = await res.json();
  return data.token;
}

async function requestBus(studentToken) {
  const res = await fetch(`${API_URL}/api/dispatch/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${studentToken}`
    },
    body: JSON.stringify({ hostel: 'YS2' }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Request failed: ${errorText}`);
  }
  return await res.json();
}

async function main() {
  console.log('Cleaning up previous test data in database...');
  try {
    execSync('docker exec shuttle_tracker_db mongosh --eval "db.BusRequest.deleteMany({}); db.DispatchEvent.deleteMany({});" shuttle_tracker', { stdio: 'ignore' });
  } catch (err) {
    console.log('Warning: Could not auto-clear DB (is the docker container running?). Proceeding anyway...');
  }

  console.log('Simulating 10 student requests...');
  const studentTokens = [];
  
  console.log('Logging in 10 students...');
  for (let i = 1; i <= 10; i++) {
    const token = await loginUser(`student${i}@test.com`, 'password123');
    studentTokens.push(token);
  }

  console.log('Firing 10 bus requests sequentially...');
  for (let i = 0; i < studentTokens.length; i++) {
    console.log(`Student ${i + 1} requesting bus...`);
    await requestBus(studentTokens[i]);
    await new Promise(r => setTimeout(r, 200)); 
  }
  
  console.log('✅ All 10 requests sent. The driver frontend should have received the dispatch!');
}

main().catch(console.error);
