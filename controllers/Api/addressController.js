const { Op } = require("sequelize");
const Address = require("../../models/Address");
const User = require("../../models/User");

// ✅ Address Store
// ✅ Address Store
exports.address_store = async (req, res) => {
  try {
    const { user_id, address, phone,name, latitude, longitude, save_as } = req.body;

    // Validation
    if (!user_id) {
      return res.status(400).json({ status: false, message: "User ID is required." });
    }
    if (!address || address.trim() === "") {
      return res.status(400).json({ status: false, message: "Address is required." });
    }
    if (!phone || phone.trim() === "") {
      return res.status(400).json({ status: false, message: "Phone number is required." });
    }
    if (!save_as || !["home", "work", "other"].includes(save_as.toLowerCase())) {
      return res.status(400).json({
        status: false,
        message: "save_as must be one of: home, work, other",
      });
    }

    // Check User exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(400).json({ status: false, message: "Invalid user ID." });
    }

    // Insert Address
    const newAddress = await Address.create({
      user_id,
      address: address.trim(),
      phone: phone.trim(),
	  name,
      latitude,
      longitude,
      save_as: save_as.toLowerCase(),
    });

    return res.status(200).json({
      status: true,
      message: "Address added successfully",
		address_id: newAddress.id, 
      data: newAddress,
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ✅ Address List (GET with route param)
exports.address_list = async (req, res) => {
  try {
    const { user_id } = req.params; // 👉 अब params से लेना है

    // 🔹 Validation
    if (!user_id) {
      return res.status(400).json({ status: false, message: "User ID is required" });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(400).json({ status: false, message: "Invalid user ID" });
    }

    // 🔹 Fetch addresses
    const addresses = await Address.findAll({ where: { user_id } });

    // 🔹 Format response
    const formattedAddresses = addresses.map(addr => ({
      address_id: addr.id,
      user_id: addr.user_id,
      address: addr.address,
      phone: addr.phone,
	  name: addr.name,
      latitude: addr.latitude,
      longitude: addr.longitude,
      save_as: addr.save_as,
      created_at: addr.created_at,
      updated_at: addr.updated_at
    }));

    return res.status(200).json({
      status: true,
      data: formattedAddresses
    });

  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ✅ Search Address
exports.search = async (req, res) => {
  try {
    const { user_id, query } = req.body;

    if (!user_id || !query) {
      return res.status(400).json({ status: false, message: "user_id and query are required" });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(400).json({ status: false, message: "Invalid user ID" });
    }

    const addresses = await Address.findAll({
      where: {
        user_id,
        address: { [Op.like]: `%${query}%` }
      }
    });

    return res.status(200).json({ status: true, data: addresses });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ✅ Update Address (POST Method using address_id + user_id)
exports.update = async (req, res) => {
  try {
    const { user_id, address_id, address, phone, name,latitude, longitude, save_as } = req.body;

    // 🔹 Validate user_id & address_id
    if (!user_id || isNaN(user_id)) {
      return res.status(400).json({ status: false, message: "Valid user_id is required." });
    }
    if (!address_id || isNaN(address_id)) {
      return res.status(400).json({ status: false, message: "Valid address_id is required." });
    }

    // 🔹 Find existing address for this user
    const existingAddress = await Address.findOne({
      where: { id: address_id, user_id }
    });

    if (!existingAddress) {
      return res.status(404).json({ status: false, message: "Address not found for this user." });
    }

    // 🔹 Validate fields
    if (!address || address.trim() === "") {
      return res.status(400).json({ status: false, message: "Address is required." });
    }
    if (!phone || phone.trim() === "") {
      return res.status(400).json({ status: false, message: "Phone number is required." });
    }
    if (save_as && !["home", "work", "other"].includes(save_as.toLowerCase())) {
      return res.status(400).json({
        status: false,
        message: "save_as must be one of: home, work, other",
      });
    }

    // 🔹 Update
    await Address.update(
      {
        address: address.trim(),
        phone: phone.trim(),
		  name,
        latitude,
        longitude,
        save_as: save_as ? save_as.toLowerCase() : existingAddress.save_as,
      },
      { where: { id: address_id, user_id } }
    );

    return res.status(200).json({
      status: true,
      message: "Address updated successfully",
      address_id,
      user_id
    });

  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};


// ✅ Delete Address (POST method using address_id + user_id)
exports.destroy = async (req, res) => {
  try {
    const { user_id, address_id } = req.body;

    // 🔹 Validate inputs
    if (!user_id || isNaN(user_id)) {
      return res.status(400).json({ status: false, message: "Valid user_id is required." });
    }
    if (!address_id || isNaN(address_id)) {
      return res.status(400).json({ status: false, message: "Valid address_id is required." });
    }

    // 🔹 Check if address exists for this user
    const existingAddress = await Address.findOne({
      where: { id: address_id, user_id }
    });

    if (!existingAddress) {
      return res.status(404).json({
        status: false,
        message: "Address not found for this user."
      });
    }

    // 🔹 Delete address
    await Address.destroy({ where: { id: address_id, user_id } });

    return res.status(200).json({
      status: true,
      message: "Address deleted successfully",
      address_id,
      user_id
    });

  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
