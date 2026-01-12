const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET all products
router.get("/", async (req, res) => {
  try {
    const [products] = await db.query(`
      SELECT 
        id,
        product_code,
        name,
        category,
        purchase_price,
        sale_price,
        quantity,
        min_stock_level,
        description,
        CASE
          WHEN quantity = 0 THEN 'Out of Stock'
          WHEN quantity <= min_stock_level THEN 'Low Stock'
          ELSE 'In Stock'
        END AS stock_status
      FROM products
      ORDER BY name
    `);

    res.json({ success: true, data: { products } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET all categories
router.get("/categories", async (req, res) => {
  try {
    const [categories] = await db.query(`
      SELECT DISTINCT category 
      FROM products 
      WHERE category IS NOT NULL AND category != ''
      ORDER BY category
    `);

    const categoryList = categories.map((cat) => cat.category);

    res.json({
      success: true,
      data: categoryList,
      total: categoryList.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET single product by ID
router.get("/:id", async (req, res) => {
  try {
    const [products] = await db.query("SELECT * FROM products WHERE id = ?", [
      req.params.id,
    ]);

    if (products.length === 0)
      return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, data: { product: products[0] } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// CREATE product
router.post("/", async (req, res) => {
  try {
    const {
      product_code,
      name,
      category,
      purchase_price,
      sale_price,
      quantity,
      min_stock_level,
      description,
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO products 
      (product_code, name, category, purchase_price, sale_price, quantity, min_stock_level, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_code || `PROD-${Date.now()}`,
        name,
        category,
        purchase_price,
        sale_price,
        quantity,
        min_stock_level || 10,
        description || "",
      ]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE product
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      product_code,
      name,
      category,
      purchase_price,
      sale_price,
      quantity,
      min_stock_level,
      description,
    } = req.body;

    await db.query(
      `UPDATE products 
       SET product_code=?, name=?, category=?, purchase_price=?, sale_price=?, quantity=?, min_stock_level=?, description=? 
       WHERE id=?`,
      [
        product_code,
        name,
        category,
        purchase_price,
        sale_price,
        quantity,
        min_stock_level,
        description,
        id,
      ]
    );

    res.json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE product
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM products WHERE id=?", [id]);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
