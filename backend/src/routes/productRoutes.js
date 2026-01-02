const express = require("express");
const router = express.Router();

// Temporary in-memory products for testing
let products = [
  {
    id: 1,
    name: "Laptop Dell XPS",
    price: 1200,
    quantity: 10,
    category: "Electronics",
    product_code: "PROD-001",
  },
  {
    id: 2,
    name: "Wireless Mouse",
    price: 25,
    quantity: 50,
    category: "Accessories",
    product_code: "PROD-002",
  },
  {
    id: 3,
    name: "Keyboard Mechanical",
    price: 45,
    quantity: 30,
    category: "Accessories",
    product_code: "PROD-003",
  },
];

// Route handler functions
const getAllProducts = (req, res) => {
  res.json(products);
};

const createProduct = (req, res) => {
  const newProduct = {
    id: products.length + 1,
    product_code: `PROD-${Date.now()}`,
    ...req.body,
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
};

const getProductById = (req, res) => {
  const product = products.find((p) => p.id == req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: "Product not found" });
  }
};

// Define routes
router.get("/", getAllProducts);
router.post("/", createProduct);
router.get("/:id", getProductById);

module.exports = router;
