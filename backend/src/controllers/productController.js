const db = require("../config/database");

exports.getAllProducts = async (req, res) => {
  try {
    const [products] = await db.query(`
            SELECT p.*, 
                   CASE 
                       WHEN p.quantity <= 0 THEN 'Out of Stock'
                       WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
                       ELSE 'In Stock'
                   END as stock_status
            FROM products p
            ORDER BY p.created_at DESC
        `);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createProduct = async (req, res) => {
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
      "INSERT INTO products (product_code, name, category, purchase_price, sale_price, quantity, min_stock_level, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        product_code,
        name,
        category,
        purchase_price,
        sale_price,
        quantity,
        min_stock_level,
        description,
      ]
    );

    // Create stock transaction record
    await db.query(
      "INSERT INTO stock_transactions (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [result.insertId, "purchase", quantity, 0, quantity, "Initial stock"]
    );

    res
      .status(201)
      .json({ id: result.insertId, message: "Product created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      quantity_change,
      notes,
      transaction_type = "adjustment",
    } = req.body;

    // Get current quantity
    const [product] = await db.query(
      "SELECT quantity FROM products WHERE id = ?",
      [id]
    );

    if (!product[0]) {
      return res.status(404).json({ error: "Product not found" });
    }

    const currentQuantity = product[0].quantity;
    const newQuantity = currentQuantity + quantity_change;

    if (newQuantity < 0) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    // Update product quantity
    await db.query("UPDATE products SET quantity = ? WHERE id = ?", [
      newQuantity,
      id,
    ]);

    // Record transaction
    await db.query(
      "INSERT INTO stock_transactions (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        transaction_type,
        quantity_change,
        currentQuantity,
        newQuantity,
        notes,
      ]
    );

    res.json({ message: "Stock updated successfully", newQuantity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
