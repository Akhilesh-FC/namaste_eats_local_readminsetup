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

    // step → 1 / 2 / 3
    // status → approve / reject

    let newStep = step;

    if (status === "approve") {
      newStep = parseInt(step) + 1;  
    }

    if (status === "reject") {
      newStep = parseInt(step); 
      await sequelize.query(
        `UPDATE restaurants SET reject_reason = :reason WHERE id = :id`,
        { replacements: { id, reason }, type: sequelize.QueryTypes.UPDATE }
      );
    }

    // Update step_id only if approved
    await sequelize.query(
      `UPDATE restaurants SET step_id = :step WHERE id = :id`,
      { replacements: { id, step: newStep }, type: sequelize.QueryTypes.UPDATE }
    );

    // STEP–4 (Final)
    if (newStep === 4) {
      await sequelize.query(
        `UPDATE restaurants SET is_active = 1 WHERE id = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.UPDATE }
      );
    }

    res.json({
      success: true,
      new_step: newStep,
      active: newStep == 4 ? 1 : 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};




// List restaurants
exports.restaurants = async (req, res) => {
  try {
    const restaurants = await sequelize.query(
      `SELECT id, name, restaurant_title, mobile, fcm_token, cod_available, address, city, state, pincode, latitude, longitude, distance, veg_type, rating, cooking_time, average_cost, image, video, is_active, step_id, created_at, updated_at
       FROM restaurants
       ORDER BY id DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.render("restaurants/index", { title: "Restaurants", restaurants });
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
