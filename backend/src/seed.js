const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Database Seed...");

  // 1. Clean old transactions/events
  await prisma.dispatchEvent.deleteMany({});
  await prisma.busRequest.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.bus.deleteMany({});
  
  // Clean default mock accounts to prevent unique constraint conflicts
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["driver@shuttle.com", "student@shuttle.com", "mock1@shuttle.com", "mock2@shuttle.com", "mock3@shuttle.com", "mock4@shuttle.com", "mock5@shuttle.com", "mock6@shuttle.com", "mock7@shuttle.com"]
      }
    }
  });

  console.log("🧹 Cleaned database collections.");

  // 2. Hash default password
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 3. Create Default Driver
  const driver = await prisma.user.create({
    data: {
      email: "driver@shuttle.com",
      password: hashedPassword,
      name: "Captain Rajesh",
      role: "driver",
      mobileNumber: "+91 9876543210",
      licenseNumber: "DL-987654"
    }
  });
  console.log(`👨‍✈️ Driver created: ${driver.email}`);

  // 4. Create Default Student
  const student = await prisma.user.create({
    data: {
      email: "student@shuttle.com",
      password: hashedPassword,
      name: "Alex Student",
      role: "student"
    }
  });
  console.log(`🎓 Default student created: ${student.email}`);

  // 5. Create Mock Buses
  const bus1 = await prisma.bus.create({ data: { busNumber: "MH-12-ST-101", capacity: 40 } });
  const bus2 = await prisma.bus.create({ data: { busNumber: "MH-12-ST-202", capacity: 40 } });
  const bus3 = await prisma.bus.create({ data: { busNumber: "MH-12-ST-303", capacity: 25 } });
  console.log("🚌 Created 3 active buses: ST-101, ST-202, ST-303.");

  // 6. Pre-seed 7 waiting student requests to make testing the 10-student threshold extremely easy!
  const mockStudents = [];
  for (let i = 1; i <= 7; i++) {
    const mockStudent = await prisma.user.create({
      data: {
        email: `mock${i}@shuttle.com`,
        name: `Student Helper ${i}`,
        role: "student"
      }
    });
    mockStudents.push(mockStudent);
  }

  // Create BusRequest logs for them
  for (let i = 0; i < mockStudents.length; i++) {
    // Alternating between YS1 and YS2
    const hostel = i % 2 === 0 ? "YS2" : "YS1";
    await prisma.busRequest.create({
      data: {
        studentId: mockStudents[i].id,
        hostel,
        status: "waiting"
      }
    });
  }

  console.log("📊 Seeded 7 waiting requests (4 at YS2, 3 at YS1).");
  console.log("✨ Seed successfully complete! Ready for local testing.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
