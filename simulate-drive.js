const io = require('socket.io-client');

const API_URL = 'http://localhost:5001';

// Coordinates
const COLLEGE = { lat: 18.6217359, lng: 73.9119325 };
const YS2 = { lat: 18.6141596, lng: 73.9116837 };

async function loginUser(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed`);
  return await res.json();
}

// Linear interpolation between two coordinates
function interpolate(start, end, fraction) {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction
  };
}

async function runDrive() {
  console.log('Logging in driver...');
  const driverData = await loginUser('driver@test.com', 'password123');
  const token = driverData.token;

  console.log('Fetching active shift...');
  const shiftRes = await fetch(`${API_URL}/api/shifts/active`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const activeShift = await shiftRes.json();
  
  if (!activeShift) {
    console.error('❌ You must have an active shift to run the drive simulator!');
    process.exit(1);
  }

  console.log(`Connecting driver socket for shift ${activeShift.id}...`);
  const socket = io(API_URL, { auth: { token } });

  socket.on('connect', () => {
    socket.emit("driver:start-shift", {
      shiftId: activeShift.id,
      busNumber: activeShift.bus.busNumber
    });

    console.log('🚗 Starting drive from College to YS2...');
    
    const steps = 30; // 30 steps total
    let currentStep = 0;

    const driveInterval = setInterval(() => {
      const fraction = currentStep / steps;
      const pos = interpolate(COLLEGE, YS2, fraction);
      
      socket.emit("driver:location-update", {
        latitude: pos.lat,
        longitude: pos.lng,
        heading: 180, // Pointing South-ish
        speed: 15 // m/s
      });
      
      console.log(`📍 Step ${currentStep}/${steps} - Lat: ${pos.lat.toFixed(5)}, Lng: ${pos.lng.toFixed(5)}`);
      
      currentStep++;
      if (currentStep > steps) {
        clearInterval(driveInterval);
        console.log('🏁 Arrived at YS2! The backend geofence should trigger a transition automatically.');
        setTimeout(() => process.exit(0), 1000);
      }
    }, 1000); // 1 step every second
  });
}

runDrive();
