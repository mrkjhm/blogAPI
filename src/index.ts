import dotenv from "dotenv";
dotenv.config();

import cookiePaser from "cookie-parser";
import cors, { CorsOptions } from "cors";
import express from "express";
import swaggerJSDoc, { Options as SwaggerJSDocOptions } from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import connectDB from "./config/db";
import { ENV } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import commentRoutes from "./routes/comment-routes";
import postRoutes from "./routes/post-routes";
import userRoutes from "./routes/user-routes";

const app = express();
const PORT = Number(ENV.PORT);

const allowed = (ENV.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Always allow the server's own origin so Swagger UI (served by this app) works
const selfOrigin = `http://localhost:${Number(ENV.PORT)}`;
if (!allowed.includes(selfOrigin)) allowed.push(selfOrigin);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookiePaser());

app.get("/", (_req, res) => {
  res.send("Hello TypeScript + Express!");
});

app.get("/hello", (_req, res) => {
  res.status(400).send("Use POST request instead with a body.");
});

app.post("/hello", (req, res) => {
  const { firstName, lastName } = req.body;
  res.send(`Hello there ${firstName} ${lastName}!`);
});


// Swagger setup
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Blog API",
    version: "1.0.0",
    description: "API documentation for the Blog backend",
  },
  tags: [
    { name: "Users", description: "User authentication and management" },
    { name: "Posts", description: "Blog post CRUD endpoints" },
    { name: "Comments", description: "Comments and threads" },
  ],
  servers: [
    { url: `http://localhost:${Number(ENV.PORT) || 3000}`, description: "Local" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      TokenPair: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      User: {
        type: "object",
        properties: {
          _id: { type: "string" },
          email: { type: "string", format: "email" },
          username: { type: "string" },
          avatarUrl: { type: "string" },
          role: { type: "string", enum: ["user", "admin"] },
        },
      },
      Post: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: { type: "string" },
          slug: { type: "string" },
          content: { type: "string" },
          imageUrl: { type: "string" },
          authorId: { type: "string" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
      },
      Comment: {
        type: "object",
        properties: {
          _id: { type: "string" },
          postId: { type: "string" },
          parentId: { type: ["string", "null"] },
          body: { type: "string" },
          authorId: { type: "string" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
      },
      ApiError: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              message: { type: "string" },
              errorCode: { type: "string" },
              details: {},
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const swaggerOptions: SwaggerJSDocOptions = {
  definition: swaggerDefinition as any,
  apis: [
    "./src/routes/*.ts",
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
if (ENV.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes)
app.use("/api/comments", commentRoutes)


app.use(errorHandler);

async function bootstrap() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

bootstrap();
