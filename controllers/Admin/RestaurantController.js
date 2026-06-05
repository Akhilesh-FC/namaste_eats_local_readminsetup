const sequelize = require("../../config/db");


exports.verifyPage = async (req, res) => {
  try {
    const id = req.params.id;

    const restaurant = await sequelize.query(
      `SELECT * FROM restaurants WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    if (!restaurant.length)
      return res.status(404).send("Restaurant not found");

    const r = restaurant[0];

    // STEP–2 Documents
    const documents = await sequelize.query(
      `SELECT * FROM restaurant_documents WHERE restaurant_id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    // STEP–3 Menu Items
    const menuItems = await sequelize.query(
      `SELECT p.*, c.name AS category, s.name AS sub_category 
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN sub_categories s ON s.id = p.sub_category_id
       WHERE p.restaurant_id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    res.render("restaurants/verify", {
      title: "Verify Restaurant",
      restaurant: r,
      documents,
      menuItems,
      step_id: r.step_id
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};


exports.verifyStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { step, status, reason } = req.body;

    // Get current step
    const [rest] = await sequelize.query(
      `SELECT step_id FROM restaurants WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    if (!rest) return res.status(404).json({ success: false, message: "Restaurant not found" });

    const currentStep = parseInt(rest.step_id) || 0;
    const reqStep = parseInt(step);

    // Block re-verification of already passed steps
    if (reqStep < currentStep) {
      return res.json({ success: false, message: `Step ${reqStep} already verified. Cannot re-verify.` });
    }

    // Block if fully verified (step_id = 4)
    if (currentStep >= 4 && status === 'approve') {
      return res.json({ success: false, message: "Restaurant is already fully verified." });
    }

    let newStep = reqStep;

    if (status === "approve") {
      newStep = reqStep + 1;
    }

    if (status === "reject") {
      await sequelize.query(
        `UPDATE restaurants SET reject_reason = :reason WHERE id = :id`,
        { replacements: { id, reason }, type: sequelize.QueryTypes.UPDATE }
      );
    }

    await sequelize.query(
      `UPDATE restaurants SET step_id = :step WHERE id = :id`,
      { replacements: { id, step: newStep }, type: sequelize.QueryTypes.UPDATE }
    );

    // Final step — activate + set login_status = 0
    if (newStep >= 4) {
      await sequelize.query(
        `UPDATE restaurants SET is_active = 1, login_status = 0 WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.UPDATE }
      );
    }

    res.json({ success: true, new_step: newStep, active: newStep >= 4 ? 1 : 0 });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Block / Unblock restaurant
exports.blockRestaurant = async (req, res) => {
  const { id } = req.params;
  try {
    const [rest] = await sequelize.query(
      `SELECT is_active FROM restaurants WHERE id = :id LIMIT 1`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!rest) return res.status(404).json({ success: false, message: "Not found" });

    // Block = is_active 0, Unblock = is_active 1 (only if step_id = 4)
    const newStatus = rest.is_active == 1 ? 0 : 1;
    await sequelize.query(
      `UPDATE restaurants SET is_active = :s, updated_at = NOW() WHERE id = :id`,
      { replacements: { s: newStatus, id }, type: sequelize.QueryTypes.UPDATE }
    );
    res.json({ success: true, is_active: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};




// List restaurants
exports.restaurants = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : "";

    const where = search ? "WHERE name LIKE :s OR mobile LIKE :s" : "";
    const replacements = search ? { s: `%${search}%`, limit, offset } : { limit, offset };

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM restaurants ${where}`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    const restaurants = await sequelize.query(
      `SELECT id, name, restaurant_title, mobile, fcm_token, cod_available, address, city, state, pincode, latitude, longitude, distance, veg_type, rating, cooking_time, average_cost, image, video, is_active, step_id, created_at, updated_at
       FROM restaurants ${where} ORDER BY id DESC LIMIT :limit OFFSET :offset`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    res.render("restaurants/index", { title: "Restaurants", restaurants, page, totalPages: Math.ceil(total / limit), search });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Toggle Active/Inactive
exports.toggleActive = async (req, res) => {
  const { id } = req.params;
  try {
    const restaurant = await sequelize.query(
      `SELECT is_active, step_id FROM restaurants WHERE id = :id LIMIT 1`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );

    if (!restaurant.length)
      return res.status(404).json({ success: false, message: "Restaurant not found" });

    const currentStatus = restaurant[0].is_active;
    const currentStep = restaurant[0].step_id;
    const newStatus = currentStatus == 1 ? 0 : 1;

    if (newStatus === 1) {
      // ✅ When activating: set step_id = 4 and is_active = 1
      await sequelize.query(
        `UPDATE restaurants SET is_active = 1, step_id = 4, updated_at = NOW() WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.UPDATE }
      );
    } else {
      // ✅ When deactivating: only set is_active = 0, keep step_id same
      await sequelize.query(
        `UPDATE restaurants SET is_active = 0, updated_at = NOW() WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.UPDATE }
      );
    }

    res.json({ success: true, is_active: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
