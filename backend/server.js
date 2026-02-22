import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/students.js";
import { getPublicKey } from "./utils/crypto.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI;
const jwtSecret = process.env.JWT_SECRET;
const clientId = process.env.OAUTH_CLIENT_ID;
const clientSecret = process.env.OAUTH_CLIENT_SECRET;

if (!mongoUri) {
    console.error("MONGO_URI is not set.");
    process.exit(1);
}

if (!jwtSecret || !clientId || !clientSecret) {
    console.error("JWT_SECRET or OAuth client credentials are not set.");
    process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
    res.send("Student API is running");
});

app.get("/public-key", (req, res) => {
    res.type("text/plain").send(getPublicKey());
});

app.use("/", authRoutes);
app.use("/students", studentRoutes);

mongoose
    .connect(mongoUri)
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection failed", error);
        process.exit(1);
    });