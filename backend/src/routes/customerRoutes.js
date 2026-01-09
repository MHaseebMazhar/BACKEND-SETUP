const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET all customers
router.get("/", async (req, res) => {
  try {
    const [customers] = await db.query(
      "SELECT id, name, phone, email, address FROM customers ORDER BY name"
    );

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE customer
router.post("/", async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    const [result] = await db.query(
      "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
      [name, phone, email, address]
    );

    res.status(201).json({
      success: true,
      message: "Customer created",
      id: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE customer
router.put("/:id", async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    await db.query(
      "UPDATE customers SET name=?, phone=?, email=?, address=? WHERE id=?",
      [name, phone, email, address, req.params.id]
    );

    res.json({ success: true, message: "Customer updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE customer
router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM customers WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "Customer deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
