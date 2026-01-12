const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Scan product by barcode
router.post("/scan", async (req, res) => {
  try {
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({
        success: false,
        error: "Barcode is required",
      });
    }

    // Search by barcode, product_code, or ID
    const [products] = await db.query(
      `SELECT 
        id,
        product_code,
        name,
        category,
        sale_price,
        quantity,
        min_stock_level,
        CASE
          WHEN quantity = 0 THEN 'Out of Stock'
          WHEN quantity <= min_stock_level THEN 'Low Stock'
          ELSE 'In Stock'
        END AS stock_status
      FROM products 
      WHERE product_code = ? OR CAST(id AS CHAR) = ? OR name LIKE ?
      LIMIT 1`,
      [barcode, barcode, `%${barcode}%`]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    const product = products[0];

    res.json({
      success: true,
      data: {
        id: product.id,
        barcode: product.product_code,
        name: product.name,
        category: product.category,
        price: product.sale_price,
        quantity: product.quantity,
        stock_status: product.stock_status,
        available: product.quantity > 0,
      },
    });
  } catch (error) {
    console.error("Barcode scan error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Bulk scan - multiple barcodes
router.post("/scan-bulk", async (req, res) => {
  try {
    const { barcodes } = req.body;

    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Barcodes array is required",
      });
    }

    const placeholders = barcodes
      .map(() => "(product_code = ? OR CAST(id AS CHAR) = ? OR name LIKE ?)")
      .join(" OR ");
    const params = [];

    barcodes.forEach((barcode) => {
      params.push(barcode, barcode, `%${barcode}%`);
    });

    const [products] = await db.query(
      `SELECT 
        id,
        product_code,
        name,
        category,
        sale_price,
        quantity,
        CASE
          WHEN quantity = 0 THEN 'Out of Stock'
          WHEN quantity <= min_stock_level THEN 'Low Stock'
          ELSE 'In Stock'
        END AS stock_status
      FROM products 
      WHERE ${placeholders}`,
      params
    );

    const results = products.map((product) => ({
      id: product.id,
      barcode: product.product_code,
      name: product.name,
      category: product.category,
      price: product.sale_price,
      quantity: product.quantity,
      stock_status: product.stock_status,
      available: product.quantity > 0,
    }));

    res.json({
      success: true,
      data: results,
      total_found: results.length,
      total_requested: barcodes.length,
    });
  } catch (error) {
    console.error("Bulk barcode scan error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Generate barcode for product
router.post("/generate/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const [product] = await db.query(
      "SELECT id, product_code FROM products WHERE id = ?",
      [productId]
    );

    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    res.json({
      success: true,
      data: {
        productId: product[0].id,
        barcode: product[0].product_code,
        message: "Barcode generated successfully",
      },
    });
  } catch (error) {
    console.error("Generate barcode error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Validate barcode format
router.post("/validate", async (req, res) => {
  try {
    const { barcode, format = "EAN13" } = req.body;

    if (!barcode) {
      return res.status(400).json({
        success: false,
        error: "Barcode is required",
      });
    }

    let isValid = false;
    let message = "";

    // EAN-13 validation
    if (format === "EAN13") {
      isValid = /^\d{13}$/.test(barcode);
      message = isValid
        ? "Valid EAN-13"
        : "Invalid EAN-13 format (must be 13 digits)";
    }
    // EAN-8 validation
    else if (format === "EAN8") {
      isValid = /^\d{8}$/.test(barcode);
      message = isValid
        ? "Valid EAN-8"
        : "Invalid EAN-8 format (must be 8 digits)";
    }
    // Code-128 validation
    else if (format === "CODE128") {
      isValid = /^[a-zA-Z0-9\-\.]{6,}$/.test(barcode);
      message = isValid ? "Valid Code-128" : "Invalid Code-128 format";
    }
    // Custom format
    else {
      isValid = barcode.length > 0;
      message = "Barcode format not specified";
    }

    res.json({
      success: true,
      data: {
        barcode,
        format,
        isValid,
        message,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
