const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Get all sales
router.get("/", async (req, res) => {
  try {
    const [sales] = await db.query(`
            SELECT s.*, c.name as customer_name 
            FROM sales s 
            LEFT JOIN customers c ON s.customer_id = c.id 
            ORDER BY sale_date DESC
        `);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create sale
router.post("/", async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { customer_id, items, discount, paid_amount, payment_method, notes } =
      req.body;

    // Calculate total
    let total_amount = 0;
    items.forEach((item) => {
      total_amount +=
        item.quantity * item.unit_price - (item.discount_amount || 0);
    });

    // Apply discount
    total_amount -= discount || 0;
    const remaining_amount = total_amount - paid_amount;

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}`;

    // Create sale record
    const [saleResult] = await connection.query(
      `INSERT INTO sales 
             (invoice_number, customer_id, total_amount, discount, paid_amount, remaining_amount, payment_method, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        customer_id,
        total_amount,
        discount || 0,
        paid_amount,
        remaining_amount,
        payment_method,
        notes,
      ]
    );

    const saleId = saleResult.insertId;

    // Create sale items and update stock
    for (const item of items) {
      // Insert sale item
      await connection.query(
        `INSERT INTO sale_items 
                 (sale_id, product_id, quantity, unit_price, discount_percent, discount_amount, line_total) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.discount_percent || 0,
          item.discount_amount || 0,
          item.quantity * item.unit_price - (item.discount_amount || 0),
        ]
      );

      // Update product stock
      await connection.query(
        "UPDATE products SET quantity = quantity - ? WHERE id = ?",
        [item.quantity, item.product_id]
      );

      // Record stock transaction
      const [product] = await connection.query(
        "SELECT quantity FROM products WHERE id = ?",
        [item.product_id]
      );

      const newQuantity = product[0].quantity - item.quantity;

      await connection.query(
        `INSERT INTO stock_transactions 
                 (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_id, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.product_id,
          "sale",
          -item.quantity,
          product[0].quantity,
          newQuantity,
          saleId,
          `Sale #${invoiceNumber}`,
        ]
      );
    }

    // Update customer balance if credit sale
    if (remaining_amount > 0 && customer_id) {
      await connection.query(
        "UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?",
        [remaining_amount, customer_id]
      );
    }

    await connection.commit();

    res.status(201).json({
      sale_id: saleId,
      invoice_number: invoiceNumber,
      message: "Sale completed successfully",
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Get sale by ID
router.get("/:id", async (req, res) => {
  try {
    const [sales] = await db.query(
      `SELECT s.*, c.name as customer_name, c.phone, c.email 
             FROM sales s 
             LEFT JOIN customers c ON s.customer_id = c.id 
             WHERE s.id = ?`,
      [req.params.id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const [items] = await db.query(
      `SELECT si.*, p.name as product_name, p.product_code 
             FROM sale_items si 
             JOIN products p ON si.product_id = p.id 
             WHERE si.sale_id = ?`,
      [req.params.id]
    );

    res.json({
      ...sales[0],
      items,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
