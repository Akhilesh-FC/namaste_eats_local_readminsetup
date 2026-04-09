const sequelize = require("../../config/db");

exports.index = async (req, res) => {
  try {
    const charges      = await sequelize.query("SELECT * FROM charges ORDER BY id DESC", { type: sequelize.QueryTypes.SELECT });
    const addonCharges = await sequelize.query("SELECT * FROM addon_charges ORDER BY id DESC", { type: sequelize.QueryTypes.SELECT });
    res.render("charges/index", { charges, addonCharges });
  } catch (err) {
    console.error("Charges Index Error:", err);
    res.status(500).send("Server Error");
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { charge_name, amount } = req.body;
  if (!charge_name || !amount) return res.status(400).json({ status: false, message: "All fields required" });
  try {
    await sequelize.query(
      "UPDATE charges SET charge_name=:charge_name, amount=:amount, updated_at=NOW() WHERE id=:id",
      { replacements: { charge_name, amount, id }, type: sequelize.QueryTypes.UPDATE }
    );
    res.json({ status: true });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.toggleStatus = async (req, res) => {
  const { id } = req.params;
  try {
    await sequelize.query(
      "UPDATE charges SET is_active = IF(is_active=1,0,1), updated_at=NOW() WHERE id=:id",
      { replacements: { id }, type: sequelize.QueryTypes.UPDATE }
    );
    const [charge] = await sequelize.query(
      "SELECT * FROM charges WHERE id=:id",
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    res.json({ status: true, charge });
  } catch (err) {
    console.error("Toggle Error:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateAddon = async (req, res) => {
  const { id } = req.params;
  const { base_delivery_charge, admin_charge, base_delivery_distance, addon_charge, estimated_distance_per_km } = req.body;
  try {
    await sequelize.query(
      "UPDATE addon_charges SET base_delivery_charge=:base_delivery_charge, admin_charge=:admin_charge, base_delivery_distance=:base_delivery_distance, addon_charge=:addon_charge, estimated_distance_per_km=:estimated_distance_per_km, updated_at=NOW() WHERE id=:id",
      {
        replacements: { base_delivery_charge, admin_charge, base_delivery_distance, addon_charge, estimated_distance_per_km, id },
        type: sequelize.QueryTypes.UPDATE
      }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Addon Update Error:", err);
    res.json({ success: false, message: err.message });
  }
};
