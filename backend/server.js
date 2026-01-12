const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection test
const db = require("./src/config/database");

// Test DB Connection
async function testDbConnection() {
  try {
    const connection = await db.getConnection();
    console.log("✅ Database connected successfully");
    connection.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
}

testDbConnection();

// Health check route
app.get("/", (req, res) => {
  res.json({
    message: "Inventory Management API is running",
    timestamp: new Date().toISOString(),
    status: "healthy",
  });
});

// API health check
app.get("/api/health", async (req, res) => {
  try {
    const [result] = await db.query("SELECT 1 as test");
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
    });
  }
});

// Auth middleware
const authMiddleware = require("./src/middleware/authMiddleware");

// Routes
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use(
  "/api/dashboard",
  authMiddleware,
  require("./src/routes/dashboardRoutes")
);

// Apply auth middleware to all protected routes
app.use("/api/products", authMiddleware, require("./src/routes/productRoutes"));
app.use("/api/sales", authMiddleware, require("./src/routes/saleRoutes"));
app.use(
  "/api/customers",
  authMiddleware,
  require("./src/routes/customerRoutes")
);
app.use("/api/reports", authMiddleware, require("./src/routes/reportRoutes"));
app.use("/api/barcode", authMiddleware, require("./src/routes/barcodeRoutes"));
app.use("/api/payments", authMiddleware, require("./src/routes/paymentRoutes"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});
