const db = require("../../config/db");
const { QueryTypes } = require("sequelize");

exports.index = (req, res) => res.render("coupons/index");

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await db.query(
      "SELECT id, coupon_code, discount_percentage, validity, min_availability, title_description, type, is_active, created_at FROM coupons ORDER BY id DESC",
      { type: QueryTypes.SELECT }
    );
    res.json({ status: true, data: coupons });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const { coupon_code, discount_percentage, validity, min_availability, title_description, type } = req.body;
    await db.query(
      "INSERT INTO coupons (coupon_code, discount_percentage, validity, min_availability, title_description, type, created_at, updated_at) VALUES (:coupon_code, :discount_percentage, :validity, :min_availability, :title_description, :type, NOW(), NOW())",
      { replacements: { coupon_code, discount_percentage, validity, min_availability, title_description, type }, type: QueryTypes.INSERT }
    );
    res.json({ status: true });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { coupon_code, discount_percentage, validity, min_availability, title_description, type } = req.body;
    await db.query(
      "UPDATE coupons SET coupon_code=:coupon_code, discount_percentage=:discount_percentage, validity=:validity, min_availability=:min_availability, title_description=:title_description, type=:type, updated_at=NOW() WHERE id=:id",
      { replacements: { coupon_code, discount_percentage, validity, min_availability, title_description, type, id }, type: QueryTypes.UPDATE }
    );
    res.json({ status: true });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM coupons WHERE id=:id", { replacements: { id }, type: QueryTypes.DELETE });
    res.json({ status: true });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};
