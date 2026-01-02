const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Dashboard stats
router.get("/dashboard", async (req, res) => {
  try {
    // Total products
    const [[{ totalProducts }]] = await db.query(
      "SELECT COUNT(*) as totalProducts FROM products"
    );

    // Total stock value
    const [[{ totalStock }]] = await db.query(
      "SELECT SUM(quantity) as totalStock FROM products"
    );

    // Today's sales
    const [[{ todaySales }]] = await db.query(
      `SELECT COUNT(*) as todaySales FROM sales 
             WHERE DATE(sale_date) = CURDATE()`
    );

    // Total revenue
    const [[{ totalRevenue }]] = await db.query(
      "SELECT COALESCE(SUM(total_amount), 0) as totalRevenue FROM sales"
    );

    // Low stock items
    const [[{ lowStockItems }]] = await db.query(
      `SELECT COUNT(*) as lowStockItems FROM products 
             WHERE quantity <= min_stock_level`
    );

    res.json({
      totalProducts,
      totalStock,
      todaySales,
      totalRevenue,
      lowStockItems,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sales report
router.get("/sales", async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
            SELECT DATE(s.sale_date) as date, 
                   COUNT(*) as total_sales,
                   SUM(s.total_amount) as total_revenue,
                   SUM(s.paid_amount) as total_paid,
                   SUM(s.remaining_amount) as total_outstanding
            FROM sales s
        `;

    const params = [];

    if (start_date && end_date) {
      query += " WHERE DATE(s.sale_date) BETWEEN ? AND ?";
      params.push(start_date, end_date);
    }

    query += " GROUP BY DATE(s.sale_date) ORDER BY date DESC";

    const [report] = await db.query(query, params);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stock report
router.get("/stock", async (req, res) => {
  try {
    const [stock] = await db.query(`
            SELECT p.*, 
                   CASE 
                       WHEN p.quantity <= 0 THEN 'Out of Stock'
                       WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
                       ELSE 'In Stock'
                   END as stock_status
            FROM products p
            ORDER BY p.quantity ASC
        `);
    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
