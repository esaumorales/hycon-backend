import { app } from './app';
import { env } from './core/config/env';
import { prisma } from './core/database/prisma';

const PORT = env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (err: any) => {
  console.error(`Error: ${err.message}`);
  console.log('Shutting down the server due to Unhandled Promise rejection');
  
  await prisma.$disconnect();
  
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown on SIGTERM / SIGINT
const shutdown = async () => {
  console.log('Gracefully shutting down...');
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
