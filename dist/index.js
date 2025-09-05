"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const db_1 = __importDefault(require("./config/db"));
const env_1 = require("./config/env");
const error_handler_1 = require("./middleware/error-handler");
const comment_routes_1 = __importDefault(require("./routes/comment-routes"));
const post_routes_1 = __importDefault(require("./routes/post-routes"));
const user_routes_1 = __importDefault(require("./routes/user-routes"));
const app = (0, express_1.default)();
const PORT = Number(env_1.ENV.PORT);
const allowed = (env_1.ENV.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
// Always allow the server's own origin so Swagger UI (served by this app) works
const selfOrigin = `http://localhost:${Number(env_1.ENV.PORT)}`;
if (!allowed.includes(selfOrigin))
    allowed.push(selfOrigin);
const corsOptions = {
    origin(origin, callback) {
        if (!origin || allowed.includes(origin))
            return callback(null, true);
        return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: false, // <-- localStorage/Bearer (no cookies)
    optionsSuccessStatus: 204,
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get("/", (_req, res) => { res.send("Hello TypeScript + Express!"); });
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
        { url: `http://localhost:${Number(env_1.ENV.PORT) || 3000}`, description: "Local" },
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
const swaggerOptions = {
    definition: swaggerDefinition,
    apis: [
        "./src/routes/*.ts",
    ],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
if (env_1.ENV.NODE_ENV !== "production") {
    app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
}
app.use("/api/users", user_routes_1.default);
app.use("/api/posts", post_routes_1.default);
app.use("/api/comments", comment_routes_1.default);
app.use(error_handler_1.errorHandler);
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
            app.listen(PORT, () => {
                console.log(`🚀 Server running at http://localhost:${PORT}`);
            });
        }
        catch (err) {
            console.error("Failed to start server:", err);
            process.exit(1);
        }
    });
}
bootstrap();
