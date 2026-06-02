const express = require("express");
const router = express.Router();
//const feedbackController = require("../../controllers/feedbackController");

const { submitFeedback, getFeedbacks} = require("../../controllers/Api/feedbackController");


// Submit feedback
router.post("/submit", submitFeedback);

// Get all feedbacks (or filter by restaurant)
router.get("/", getFeedbacks);

module.exports = router;
