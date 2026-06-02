import Coupon from "../../models/Coupon.js";

// ✅ Get all coupons
export const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.findAll({
      order: [["id", "ASC"]],
      attributes: [
        "id",
        "coupon_code",
        "discount_percentage",
        "validity",
        "min_availability",
        "title_description",
		  "type",
      ]
    });

    res.json({
      status: true,
      message: "Coupons fetched successfully",
      data: coupons
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ✅ Create coupon
export const createCoupon = async (req, res) => {
  try {
    const { coupon_code, discount_percentage, validity, min_availability, title_description } = req.body;

    const newCoupon = await Coupon.create({
      coupon_code,
      discount_percentage,
      validity,
      min_availability,
      title_description
    });

    res.json({
      status: true,
      message: "Coupon created successfully",
      data: newCoupon
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ✅ Update coupon
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { coupon_code, discount_percentage, validity, min_availability, title_description } = req.body;

    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.status(404).json({ status: false, message: "Coupon not found" });

    await coupon.update({ coupon_code, discount_percentage, validity, min_availability, title_description });

    res.json({
      status: true,
      message: "Coupon updated successfully",
      data: coupon
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ✅ Delete coupon
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByPk(id);
    if (!coupon) return res.status(404).json({ status: false, message: "Coupon not found" });

    await coupon.destroy();
    res.json({ status: true, message: "Coupon deleted successfully" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};
