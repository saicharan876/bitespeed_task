import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import identifyRouter from "./routes/identify";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use("/", identifyRouter);

// Health check
app.get("/", (_req: Request, res: Response) => {
    res.json({ status: "ok", message: "Bitespeed Identity Reconciliation Service" });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
