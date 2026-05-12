const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    const admins = await p.user.findMany({ where: { isAdmin: true }, select: { id: true, email: true } });
    console.log('Admin users (id, email):', admins);

    const reqs = await p.pVTopupRequest.findMany({
      select: { id: true, status: true, memberId: true },
      orderBy: { createdDate: 'desc' },
    });
    console.log('PV request summary:', reqs);
  } finally {
    await p.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

