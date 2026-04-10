const sequelize = require("../../config/db");
const { QueryTypes } = require("sequelize");

exports.list = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : "";

    const where = search
      ? `WHERE (d.first_name LIKE :s OR d.last_name LIKE :s OR d.mobile_number LIKE :s OR d.email LIKE :s)`
      : "";

    const replacements = search ? { s: `%${search}%`, limit, offset } : { limit, offset };

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) as total FROM deliveryboys d ${where}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const boys = await sequelize.query(
      `SELECT d.id, d.first_name, d.last_name, d.mobile_number, d.email,
              d.profile_picture, d.address, d.vehicle_type, d.identity_type,
              d.identity_number, d.identity_image, d.driving_license_number,
              d.driving_license_image, d.status, d.current_status, d.on_off_status,
              d.createdAt,
              COUNT(o.id) AS total_orders
       FROM deliveryboys d
       LEFT JOIN orders o ON o.delivery_boy_id = d.id
       ${where}
       GROUP BY d.id
       ORDER BY d.id DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const totalPages = Math.ceil(total / limit);
    res.render("deliveryboys/index", { boys, page, totalPages, search });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.orders = async (req, res) => {
  try {
    const { id } = req.params;

    const [boy] = await sequelize.query(
      "SELECT id, first_name, last_name, mobile_number FROM deliveryboys WHERE id=:id",
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    const orders = await sequelize.query(
      `SELECT o.id, o.order_id, u.name AS customer_name, r.name AS restaurant_name,
              o.amount, o.order_status, o.payment_status, o.created_at
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.delivery_boy_id = :id
       ORDER BY o.id DESC`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    res.render("deliveryboys/orders", { boy, orders });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
