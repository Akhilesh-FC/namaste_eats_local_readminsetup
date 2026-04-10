const sequelize = require("../../config/db");
const { QueryTypes } = require("sequelize");

exports.list = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : "";
    const restId = req.query.restaurant_id || "";

    let where = "WHERE 1=1";
    const replacements = { limit, offset };

    if (search) {
      where += " AND (p.name LIKE :s OR c.name LIKE :s OR s.name LIKE :s)";
      replacements.s = `%${search}%`;
    }
    if (restId) {
      where += " AND p.restaurant_id = :restId";
      replacements.restId = restId;
    }

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) as total FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN sub_categories s ON s.id = p.sub_category_id
       ${where}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const products = await sequelize.query(
      `SELECT p.id, p.name, p.price, p.veg_type, p.status, p.thumbnail_image,
              p.description, p.created_at,
              r.name AS restaurant_name,
              c.name AS category_name,
              s.name AS sub_category_name
       FROM products p
       LEFT JOIN restaurants r ON r.id = p.restaurant_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN sub_categories s ON s.id = p.sub_category_id
       ${where}
       ORDER BY p.id DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    // Fetch all media and variants for listed products
    const productIds = products.map(p => p.id);
    let mediaMap = {}, variantMap = {};

    if (productIds.length > 0) {
      const media = await sequelize.query(
        `SELECT * FROM product_media WHERE product_id IN (:ids)`,
        { replacements: { ids: productIds }, type: QueryTypes.SELECT }
      );
      media.forEach(m => {
        if (!mediaMap[m.product_id]) mediaMap[m.product_id] = [];
        mediaMap[m.product_id].push(m);
      });

      const variants = await sequelize.query(
        `SELECT pv.*, ut.name AS unit_name FROM product_variants pv
         LEFT JOIN unit_types ut ON ut.id = pv.unit_type_id
         WHERE pv.product_id IN (:ids)`,
        { replacements: { ids: productIds }, type: QueryTypes.SELECT }
      );
      variants.forEach(v => {
        if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
        variantMap[v.product_id].push(v);
      });
    }

    const restaurants = await sequelize.query(
      "SELECT id, name FROM restaurants ORDER BY name ASC",
      { type: QueryTypes.SELECT }
    );

    res.render("products/index", {
      products, restaurants, mediaMap, variantMap,
      page, totalPages: Math.ceil(total / limit), search, restId
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
