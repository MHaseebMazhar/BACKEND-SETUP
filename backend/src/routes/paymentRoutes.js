const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET all payment methods
router.get("/", async (req, res) => {
  try {
    const [methods] = await db.query(
      `SELECT id, name, type, is_active, created_at 
       FROM payment_methods 
       WHERE is_active = 1 
       ORDER BY name`
    );

    res.json({
      success: true,
      data: methods || [],
      total: methods?.length || 0,
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// CREATE payment method
router.post("/", async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: "Name and type are required",
      });
    }

    const validTypes = [
      "cash",
      "card",
      "cheque",
      "bank_transfer",
      "mobile_wallet",
      "credit",
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const [result] = await db.query(
      `INSERT INTO payment_methods (name, type, is_active) 
       VALUES (?, ?, 1)`,
      [name, type]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name,
        type,
        message: "Payment method created successfully",
      },
    });
  } catch (error) {
    console.error("Create payment method error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// UPDATE payment method
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, is_active } = req.body;

    const validTypes = [
      "cash",
      "card",
      "cheque",
      "bank_transfer",
      "mobile_wallet",
      "credit",
    ];

    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push("name = ?");
      params.push(name);
    }
    if (type) {
      updates.push("type = ?");
      params.push(type);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update",
      });
    }

    params.push(id);

    await db.query(
      `UPDATE payment_methods SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: "Payment method updated successfully",
    });
  } catch (error) {
    console.error("Update payment method error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Process payment
router.post("/process", async (req, res) => {
  try {
    const { sale_id, amount, payment_method_id, reference_number, notes } =
      req.body;

    if (!sale_id || !amount || !payment_method_id) {
      return res.status(400).json({
        success: false,
        error: "sale_id, amount, and payment_method_id are required",
      });
    }

    // Get sale info
    const [sales] = await db.query(
      "SELECT id, remaining_amount FROM sales WHERE id = ?",
      [sale_id]
    );

    if (sales.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Sale not found",
      });
    }

    const sale = sales[0];

    if (amount > sale.remaining_amount) {
      return res.status(400).json({
        success: false,
        error: `Amount exceeds remaining balance (${sale.remaining_amount})`,
      });
    }

    // Record payment
    const [result] = await db.query(
      `INSERT INTO payments (sale_id, payment_method_id, amount, reference_number, notes, payment_date)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        sale_id,
        payment_method_id,
        amount,
        reference_number || null,
        notes || null,
      ]
    );

    // Update sale remaining amount
    const newRemaining = sale.remaining_amount - amount;
    await db.query("UPDATE sales SET remaining_amount = ? WHERE id = ?", [
      newRemaining,
      sale_id,
    ]);

    res.json({
      success: true,
      data: {
        payment_id: result.insertId,
        sale_id,
        amount_paid: amount,
        remaining_balance: newRemaining,
        message: "Payment processed successfully",
      },
    });
  } catch (error) {
    console.error("Process payment error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET payment history for sale
router.get("/history/:saleId", async (req, res) => {
  try {
    const { saleId } = req.params;

    const [payments] = await db.query(
      `SELECT p.id, p.amount, pm.name as method_name, p.reference_number, 
              p.notes, p.payment_date
       FROM payments p
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       WHERE p.sale_id = ?
       ORDER BY p.payment_date DESC`,
      [saleId]
    );

    res.json({
      success: true,
      data: payments || [],
      total_payments: payments?.length || 0,
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET payment statistics
router.get("/stats/daily", async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    let query = `
      SELECT pm.name as payment_method, 
             COUNT(*) as transaction_count,
             SUM(p.amount) as total_amount,
             AVG(p.amount) as avg_amount
      FROM payments p
      JOIN payment_methods pm ON p.payment_method_id = pm.id
    `;

    const params = [];

    if (from_date && to_date) {
      query += ` WHERE DATE(p.payment_date) BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    }

    query += ` GROUP BY pm.id ORDER BY total_amount DESC`;

    const [stats] = await db.query(query, params);

    res.json({
      success: true,
      data: stats || [],
      date_range:
        from_date && to_date ? `${from_date} to ${to_date}` : "All time",
    });
  } catch (error) {
    console.error("Get payment stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
