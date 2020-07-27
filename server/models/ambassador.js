'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const Contract = require('./contract');

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Ambassador schema.
const AmbassadorSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  firstName: String,
  lastName: String,
  created: { type: Date, default: Date.now },

  // Stripe account ID to send payments obtained with Stripe Connect.
  stripeAccountId: String,
});

// Return an ambassador name for display.
AmbassadorSchema.methods.displayName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// List contracts from the past month for the ambassador.
AmbassadorSchema.methods.listRecentContracts = async function() {
  const monthAgo = Date.now() - (30*24*60*60*1000);
  return Contract.find({ ambassador: this, created: { $gte: monthAgo } })
    .populate('brand')
    .sort({ created: -1 })
    .exec();
};

// Generate a password hash (with an auto-generated salt for simplicity here).
AmbassadorSchema.methods.generateHash = function(password) {
  return bcrypt.hashSync(password, 8);
};

// Check if the password is valid by comparing with the stored hash.
AmbassadorSchema.methods.validatePassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

// Get the first fully onboarded ambassador.
AmbassadorSchema.statics.getFirstOnboarded = function() {
  return Ambassador.findOne({ stripeAccountId: { $ne: null } })
    .sort({ created: 1 })
    .exec();
};

// Get the latest fully onboarded ambassador.
AmbassadorSchema.statics.getLatestOnboarded = function() {
  return Ambassador.findOne({ stripeAccountId: { $ne: null } })
    .sort({ created: -1 })
    .exec();
};

// Make sure the email has not been used.
AmbassadorSchema.path('email').validate({
  isAsync: true,
  validator: function(email, callback) {
    const Ambassador = mongoose.model('Ambassador');
    // Check only when it is a new ambassador or when the email has been modified.
    if (this.isNew || this.isModified('email')) {
      Ambassador.find({ email: email }).exec(function(err, ambassadors) {
        callback(!err && ambassadors.length === 0);
      });
    } else {
      callback(true);
    }
  },
  message: 'This email already exists. Please try to log in instead.',
});

// Pre-save hook to ensure consistency.
AmbassadorSchema.pre('save', function(next) {
  // Make sure the password is hashed before being stored.
  if (this.isModified('password')) {
    this.password = this.generateHash(this.password);
  }
  next();
});

const Ambassador = mongoose.model('Ambassador', AmbassadorSchema);

module.exports = Ambassador;
