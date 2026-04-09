const { Op } = require("sequelize");
const Feedback = require("../../models/Feedback");
const User = require("../../models/User");

exports.submitFeedback = async (req, res) => {
  try {
    const { user_id, rating, comments } = req.body;

    if (!user_id || !rating) {
      return res.status(400).json({
        status: false,
        message: "user_id,  aur rating required hai",
      });
    }

    const feedback = await Feedback.create({
      user_id,
      rating,
      comments,
    });

    return res.status(200).json({
      status: true,
      message: "Feedback submitted successfully",
      data: feedback,
    });

  } catch (error) {
    console.error(error);
    return res.status(400).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

exports.getFeedbacks = async (req, res) => {
    try {
        const { restaurant_id } = req.query;

        if (!restaurant_id) {
            return res.status(400).json({
                status: false,
                message: "restaurant_id is required",
            });
        }

        const feedbacks = await Feedback.findAll({
            where: { restaurant_id },
            order: [["id", "DESC"]]   // 👈 Order by id instead of createdAt
        });

        return res.status(200).json({
            status: true,
            message: "Feedbacks fetched successfully",
            data: feedbacks
        });
    } catch (error) {
        return res.status(400).json({
            status: false,
            message: "Failed to fetch feedbacks",
            error: error.message
        });
    }
};