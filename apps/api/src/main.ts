import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL);
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');
  
  const allowedOrigins = [
    process.env.APP_URL ? `https://${process.env.APP_URL}` : 'http://localhost:3017',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3017',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by CORS'), false);
      }
    },
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`NexoZap API running on port ${port}`);
}
bootstrap();
