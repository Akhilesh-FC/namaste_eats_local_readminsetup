const { QueryTypes } = require("sequelize");
const sequelize = require("../../config/db");

const { Product, ProductVariant } = require("../../models"); // apne models import karo


// ✅ Get Products with Category
exports.getProducts = async (req, res) => {
  try {
    const { type, category_id } = req.query;

    let sql = `
      SELECT p.id, p.name, p.description, p.price, p.veg_type, p.thumbnail_image,
             c.name AS category_name
      FROM products p
      INNER JOIN categories c ON p.category_id = c.id
      WHERE p.status = 1 AND c.status = 1
    `;

    let replacements = {};

    // ✅ Apply filters
    if (type) {
      sql += " AND p.type = :type";
      replacements.type = type;
    }

    if (category_id) {
      sql += " AND p.category_id = :category_id";
      replacements.category_id = category_id;
    }

    const products = await sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });

    return res.json({
      status: true,
      message: "Products fetched successfully",
      data: products,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};
