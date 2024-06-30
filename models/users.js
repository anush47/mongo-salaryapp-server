const mongoose = require("mongoose");

// Define User schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
});

// Create User model
const User = mongoose.model("user", userSchema);

module.exports = User;
