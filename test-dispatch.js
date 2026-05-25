const io = require('socket.io-client');

const API_URL = 'http://localhost:5001';

async function loginUser(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.statusText}`);
  }
  const data = await res.json();
  return data;
}

async function requestBus(token) {
  const res = await fetch(`${API_URL}/api/dispatch/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ hostel: 'YS2' }), // Ensure it counts towards YS2 or just requests
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (errorText.includes("already have an active request")) {
      console.log(`Student already has an active request, ignoring...`);
      return { skipped: true };
    }
    throw new Error(`Request bus failed: ${res.status} - ${errorText}`);
  }
  return await res.json();
}

async function runTest() {
  console.log('Starting Dispatch Threshold Test...');
  try {
    // 1. Log in the driver to listen for the event
    console.log('Logging in driver...');
    const driverData = await loginUser('driver@test.com', 'password123');
    const driverToken = driverData.token;

    // Connect driver socket
    console.log('Connecting driver socket...');
    const driverSocket = io(API_URL, {
      auth: { token: driverToken },
    });

    let dispatchTriggered = false;
    driverSocket.on('dispatch:triggered', (data) => {
      console.log('✅ Driver received dispatch:triggered event!', data);
      dispatchTriggered = true;
      
      // We can exit after success
      setTimeout(() => {
        console.log('Test completed successfully.');
        process.exit(0);
      }, 1000);
    });

    driverSocket.on('connect', () => {
      console.log('Driver socket connected.');
    });

    // Wait a brief moment for socket connection
    await new Promise((r) => setTimeout(r, 1000));

    // Start a shift for the driver
    console.log('Fetching active buses...');
    const busesRes = await fetch(`${API_URL}/api/buses`);
    const buses = await busesRes.json();
    if (buses.length === 0) {
      throw new Error("No active buses found");
    }
    const busId = buses[0].id;
    
    console.log(`Starting shift on bus ${busId}...`);
    const shiftRes = await fetch(`${API_URL}/api/shifts/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ busId }),
    });
    if (!shiftRes.ok) {
       const err = await shiftRes.text();
       // Ignore "already have an active shift" error if it happens
       if (!err.includes("active shift")) {
           throw new Error(`Failed to start shift: ${err}`);
       }
       console.log("Driver already had an active shift, proceeding...");
    } else {
       console.log("Shift started successfully.");
    }

    // 2. Log in 10 students and request bus
    console.log('Logging in 10 students and sending bus requests...');
    const studentTokens = [];
    for (let i = 1; i <= 10; i++) {
      const studentData = await loginUser(`student${i}@test.com`, 'password123');
      studentTokens.push(studentData.token);
    }

    // Fire off 10 requests sequentially
    console.log('Firing 10 bus requests sequentially...');
    for (let i = 0; i < studentTokens.length; i++) {
      console.log(`Student ${i + 1} requesting bus...`);
      await requestBus(studentTokens[i]);
      // Small delay to simulate real-world arrival and allow transactions to commit
      await new Promise(r => setTimeout(r, 200)); 
    }
    console.log('All 10 requests sent.');

    // Wait to see if event comes in
    setTimeout(() => {
      if (!dispatchTriggered) {
        console.error('❌ Timeout: Did not receive dispatch:triggered event within 5 seconds.');
        process.exit(1);
      }
    }, 5000);

  } catch (error) {
    console.error('Test Error:', error);
    process.exit(1);
  }
}

runTest();
