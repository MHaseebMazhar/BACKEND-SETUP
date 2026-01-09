const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET all sales
router.get("/", async (req, res) => {
  try {
    const [sales] = await db.query(`
      SELECT s.id, s.invoice_number, s.sale_date,
             s.total_amount, s.paid_amount, s.remaining_amount,
             c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.sale_date DESC
    `);

    res.json({ success: true, data: { sales } });
  } catch (err) {
    console.error("SALES FETCH ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE new sale
router.post("/", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      customer_id,
      items,
      paid_amount = 0,
      payment_method = "cash",
    } = req.body;

    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least 1 item is required" });
    }

    // Begin transaction
    await connection.beginTransaction();

    // Calculate total
    let total = 0;
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        throw new Error(
          "Invalid item: product_id, quantity, and unit_price required"
        );
      }
      total += item.quantity * item.unit_price;
    }

    const remaining = Math.max(total - paid_amount, 0);
    const invoice = `INV-${Date.now()}`;

    // Insert sale
    const discount = 0;

    const [sale] = await connection.query(
      `INSERT INTO sales
   (invoice_number, customer_id, total_amount, discount, paid_amount, remaining_amount, payment_method, sale_date, notes)
   VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        invoice,
        customer_id || null,
        total,
        discount,
        paid_amount,
        remaining,
        payment_method,
        null,
      ]
    );

    // Insert sale items and update stock
    for (const item of items) {
      // Get current stock
      const [productRows] = await connection.query(
        "SELECT quantity FROM products WHERE id = ?",
        [item.product_id]
      );

      if (!productRows.length) {
        throw new Error(`Product ID ${item.product_id} not found`);
      }

      const previousQty = productRows[0].quantity;
      const newQty = previousQty - item.quantity;

      if (newQty < 0) {
        throw new Error(`Insufficient stock for product ID ${item.product_id}`);
      }

      // Insert sale item
      await connection.query(
        `INSERT INTO sale_items
          (sale_id, product_id, quantity, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?)`,
        [
          sale.insertId,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price,
        ]
      );

      // Update product stock
      await connection.query("UPDATE products SET quantity = ? WHERE id = ?", [
        newQty,
        item.product_id,
      ]);

      // Log stock transaction
      await connection.query(
        `INSERT INTO stock_transactions
          (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, notes)
          VALUES (?, 'sale', ?, ?, ?, ?)`,
        [
          item.product_id,
          -item.quantity,
          previousQty,
          newQty,
          `Sale ${sale.insertId}`,
        ]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      sale: {
        id: sale.insertId,
        invoice_number: invoice,
        total_amount: total,
        paid_amount,
        remaining_amount: remaining,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error("SALE CREATE ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
