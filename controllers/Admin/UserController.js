const sequelize = require("../../config/db");
const { QueryTypes } = require("sequelize");

exports.users = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : "";

    const where = search
      ? `WHERE (name LIKE :s OR email LIKE :s OR mobile_no LIKE :s)`
      : "";
    const replacements = search ? { s: `%${search}%`, limit, offset } : { limit, offset };

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) as total FROM users ${where}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const users = await sequelize.query(
      `SELECT u.id, u.name, u.profile_image, u.email, u.mobile_no, u.dob,
              u.anniversary, u.gender, u.status, u.created_at,
              COUNT(o.id) AS total_orders
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.id DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    res.render("users/index", { title: "Users", users, page, totalPages: Math.ceil(total / limit), search });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.userOrders = async (req, res) => {
  try {
    const { id } = req.params;
    const [user] = await sequelize.query(
      "SELECT id, name, email, mobile_no, profile_image FROM users WHERE id=:id",
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    const orders = await sequelize.query(
      `SELECT o.id, o.order_id, r.name AS restaurant_name, p.name AS product_name,
              o.amount, o.order_status, o.payment_status, o.current_address, o.created_at
       FROM orders o
       LEFT JOIN restaurants r ON r.id = o.restaurant_id
       LEFT JOIN products p ON p.id = o.product_id
       WHERE o.user_id = :id
       ORDER BY o.id DESC`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    res.render("users/orders", { user, orders });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.toggleStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const [user] = await sequelize.query(
      "SELECT status FROM users WHERE id=:id LIMIT 1",
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    const newStatus = user.status === "active" ? "inactive" : "active";
    await sequelize.query(
      "UPDATE users SET status=:status, updated_at=NOW() WHERE id=:id",
      { replacements: { status: newStatus, id }, type: QueryTypes.UPDATE }
    );
    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
