const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Get all customers
router.get("/", async (req, res) => {
  try {
    const [customers] = await db.query("SELECT * FROM customers ORDER BY name");
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create customer
router.post("/", async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    const [result] = await db.query(
      "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
      [name, phone, email, address]
    );

    res.status(201).json({
      id: result.insertId,
      message: "Customer created successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
