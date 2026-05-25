const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with dummy data...');

  // Delete existing data to prevent conflicts during re-runs
  await prisma.busRequest.deleteMany();
  await prisma.dispatchEvent.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('password123', 10);

  // 1. Create a dummy driver
  const driver = await prisma.user.create({
    data: {
      email: 'driver@test.com',
      password,
      name: 'Test Driver',
      role: 'driver',
      mobileNumber: '+1234567890',
      licenseNumber: 'DL-TEST-123',
    },
  });
  console.log('Created driver:', driver.email);

  // 2. Create 10 dummy students
  const students = [];
  for (let i = 1; i <= 10; i++) {
    const student = await prisma.user.create({
      data: {
        email: `student${i}@test.com`,
        password,
        name: `Student ${i}`,
        role: 'student',
      },
    });
    students.push(student);
    console.log(`Created student ${i}:`, student.email);
  }

  // 3. Create a dummy bus
  const bus = await prisma.bus.create({
    data: {
      busNumber: 'TEST-BUS-01',
      capacity: 40,
      isActive: true,
    },
  });
  console.log('Created bus:', bus.busNumber);

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
