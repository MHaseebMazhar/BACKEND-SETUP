const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.get("/", async (req, res) => {
  try {
    const [[products]] = await db.query(
      "SELECT COUNT(*) as totalProducts, SUM(quantity) as totalStock FROM products"
    );

    const [[sales]] = await db.query(
      "SELECT COUNT(*) as todaySales, SUM(total_amount) as totalRevenue FROM sales WHERE DATE(sale_date)=CURDATE()"
    );

    const [[lowStock]] = await db.query(
      "SELECT COUNT(*) as lowStockItems FROM products WHERE quantity <= min_stock_level"
    );

    res.json({
      totalProducts: products.totalProducts || 0,
      totalStock: products.totalStock || 0,
      todaySales: sales.todaySales || 0,
      totalRevenue: sales.totalRevenue || 0,
      lowStockItems: lowStock.lowStockItems || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
