declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    MONGODB_URI: string;
    CORS_ORIGINS?: string; // comma-separated
    BCRYPT_SALT_ROUNDS: string; // required (no ?)
    NODE_ENV?: 'development' | 'test' | 'production';
    JWT_SECRET_KEY: string;
    ACCESS_TOKEN_SECRET: string;
    REFRESH_TOKEN_SECRET: string;
    ACCESS_TOKEN_TTL?: string;   // e.g. "15m" | "1h" | "7d"
    REFRESH_TOKEN_TTL?: string;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
  }
}

