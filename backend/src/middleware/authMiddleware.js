const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // Skip auth for login/signup
  if (req.path.includes("/login") || req.path.includes("/signup"))
    return next();

  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "change_this_secret_key_in_env"
    );
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = authMiddleware;
