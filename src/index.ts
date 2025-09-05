import dotenv from "dotenv";
dotenv.config();

import cors, { CorsOptions } from "cors";
import express from "express";
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
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: false,         // <-- localStorage/Bearer (no cookies)
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get("/", (_req, res) => { res.send("Hello TypeScript + Express!"); });

app.get("/hello", (_req, res) => {
  res.status(400).send("Use POST request instead with a body.");
});

app.post("/hello", (req, res) => {
  const { firstName, lastName } = req.body;
  res.send(`Hello there ${firstName} ${lastName}!`);
});

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
