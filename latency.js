const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  const start1 = Date.now();
  await prisma.$queryRawUnsafe("SELECT 1");
  console.log("Primera:", Date.now() - start1, "ms");

  const start2 = Date.now();
  await prisma.$queryRawUnsafe("SELECT 1");
  console.log("Segunda:", Date.now() - start2, "ms");

  await prisma.$disconnect();
})();
