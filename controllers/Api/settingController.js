const db = require("../../config/db"); 
const { Category, Filter,Slider ,Paymode,AddonCharge } = require("../../models"); 

const index = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, title, slug, content, status FROM settings WHERE status = '1'"
    );

    let formattedData = {};

    rows.forEach(row => {
      if (row.slug === "about-us") {
        formattedData["about_us"] = row.id;
        formattedData["about_content"] = row.content;
      }
      if (row.slug === "privacy-policy") {
        formattedData["privacy_policy"] = row.id;
        formattedData["privacy_policy_content"] = row.content;
      }
      if (row.slug === "help-support") {
        formattedData["help_support"] = row.id;
        formattedData["help_support_content"] = row.content;
      }
      if (row.slug === "terms & conditions") {
        formattedData["terms_conditions"] = row.id;
        formattedData["terms_conditions_content"] = row.content;
      }
    });

    // ✅ 2. Categories table se data
    const categoriesData = await Category.findAll({
      where: { status: 1 },
      order: [["id", "ASC"]],
      attributes: ["id", "name", "description", "icon", "image", "veg_type"]
    });

    const categories = categoriesData.map(cat => ({
      cat_id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      image: cat.image,
      veg_type: cat.veg_type,
      res_pro_title: "Dish"
    }));

    // ✅ 3. Filters table se data
    const filtersData = await Filter.findAll({
      order: [["id", "ASC"]],
      attributes: ["id", "filter_name"]
    });

    const filters = filtersData.map(f => ({
      filter_id: f.id,
      filter_name: f.filter_name
    }));

    // ✅ 4. Slider table se first image
    const sliderData = await Slider.findAll({
      order: [["id", "ASC"]],
      attributes: ["image"]
    });

	  const slider = sliderData.map(s => s.image);

	  //const slider = sliderData.map(s => ({id: s.id,image: s.image}));
    //const slider = sliderData ? sliderData.image : null;

    // ✅ 5. Paymodes table se data
    const paymodesData = await Paymode.findAll({
      where: { is_active: true },
      order: [["id", "ASC"]],
      attributes: ["id", "paymode_name", "icon"]
    });

    const paymodes = paymodesData.map(p => ({
      paymode_id: p.id,
      name: p.paymode_name,
      icon: p.icon
    }));
	  
	  
	   // ✅ 6. Addon Charges (NEW)
    const addonChargesData = await db.query(
      "SELECT id, base_delivery_charge, base_delivery_distance, addon_charge, estimated_distance_per_km, is_active FROM addon_charges WHERE is_active = 1"
    );

    const addon_charges = addonChargesData[0].map(a => ({
      id: a.id,
      base_delivery_charge: a.base_delivery_charge,
      base_delivery_distance: a.base_delivery_distance,
      addon_charge: a.addon_charge,
      estimated_distance_per_km: a.estimated_distance_per_km,
      is_active: a.is_active
    }));
	  

    // ✅ Final Response
    return res.json({
      status: true,
      message: "Pages, Categories, Filters, Slider & Paymodes fetched successfully",
      data: {
        pages: formattedData,
        categories: categories,
        filters: filters,
        slider: slider,
        paymodes: paymodes,   // 🔥 slider ke andar nahi, alag object me
		addon_charges: addon_charges   // 🔥 New Added
      }
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong"
    });
  }
};



// ✅ Single page by slug
const show = async (req, res) => {
  try {
    const slug = req.params.slug;

    const [rows] = await db.query(
      "SELECT id, title, slug, content, status FROM settings WHERE slug = ? AND status = '1' LIMIT 1",
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Page not found"
      });
    }

    return res.json({
      status: true,
      message: "Page fetched successfully",
      data: rows[0]
    });
  } catch (error) {
    console.error("Error fetching page:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong"
    });
  }
};

module.exports = { index, show };
