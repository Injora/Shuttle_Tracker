const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Setting waiting requests queue to exactly 9...");
  
  // 1. Clean existing waiting requests
  await prisma.busRequest.deleteMany({
    where: { status: "waiting" }
  });

  // 2. Clean old mockup students to avoid any unique constraints or duplicate lists
  await prisma.user.deleteMany({
    where: {
      email: {
        in: Array.from({ length: 9 }, (_, i) => `mockhelper${i + 1}@shuttle.com`)
      }
    }
  });

  // 3. Create exactly 9 waiting requests linked to unique mock students
  for (let i = 1; i <= 9; i++) {
    const email = `mockhelper${i}@shuttle.com`;
    const user = await prisma.user.create({
      data: {
        email,
        name: `Student Helper ${i}`,
        role: "student"
      }
    });

    const hostel = i % 2 === 0 ? "YS2" : "YS1";
    await prisma.busRequest.create({
      data: {
        studentId: user.id,
        hostel,
        status: "waiting"
      }
    });
  }

  console.log("✨ Successfully seeded exactly 9 waiting requests!");
  console.log("👉 Student YS1 requests: 5, Student YS2 requests: 4.");
}

main()
  .catch((e) => {
    console.error("❌ Failed to set queue to 9:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
