const sequelize = require("../../config/db");

exports.orders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    let whereClause = "";
    let replacements = { limit, offset };

    if (search) {
      whereClause = `
        WHERE o.order_id LIKE :search 
        OR u.name LIKE :search 
        OR r.name LIKE :search 
        OR o.order_status LIKE :search 
        OR o.payment_status LIKE :search
      `;
      replacements.search = `%${search}%`;
    }

    // ✅ Total count
    const totalCountResult = await sequelize.query(
      `SELECT COUNT(*) as count 
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN restaurants r ON r.id = o.restaurant_id
       ${whereClause}`,
      {
        replacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );
    const totalCount = totalCountResult[0].count;
    const totalPages = Math.ceil(totalCount / limit);

    // ✅ Paginated data
    const orders = await sequelize.query(
      `SELECT o.id, o.order_id,
              u.name AS user_name,
              r.name AS restaurant_name,
              p.name AS product_name,
              pv.name AS variant_name,
              o.product_quantity, o.amount, o.paymode, o.currency,
              o.order_status, o.payment_status,
              o.coupon_discount_amount, o.charges, o.gst,
              o.delivery_charges, o.current_address, o.created_at
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN restaurants r ON r.id = o.restaurant_id
       LEFT JOIN products p ON p.id = o.product_id
       LEFT JOIN product_variants pv ON pv.id = o.product_variant_id
       ${whereClause}
       ORDER BY o.id DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // ✅ AJAX (detect manually if ?ajax=true or header)
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.ajax === 'true') {
      return res.render("orders/table", { orders }, (err, html) => {
        if (err) throw err;
        return res.json({
          html,
          totalPages,
          currentPage: page
        });
      });
    }

    // ✅ Full render
    res.render("orders/index", {
      title: "Orders",
      orders,
      totalPages,
      currentPage: page,
      search
    });

  } catch (err) {
    console.error("Orders fetch error:", err);
    res.status(500).send("Server Error");
  }
};
