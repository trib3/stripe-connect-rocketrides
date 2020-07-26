'use strict';

const config = require('../config');
const stripe = require('stripe')(config.stripe.secretKey);
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Brand schema.
const BrandSchema = new Schema({
  clientEmail: { type: String, required: true, unique: true },
  tribeEmail: { type: String, required: true, unique: false },
  name: String,
  created: { type: Date, default: Date.now },

  // Stripe customer ID storing the payment sources.
  stripeCustomerId: String
});

// Return a brand name for display.
BrandSchema.methods.displayName = function() {
  return this.name;
};

// Get the latest brand.
BrandSchema.statics.getLatest = async function() {
  try {
    // Count all the brands.
    const count = await Brand.countDocuments().exec();
    if (count === 0) {
      // Create default brands.
      await Brand.insertDefaultBrands();
    }
    // Return latest brand.
    return Brand.findOne()
      .sort({ created: -1 })
      .exec();
  } catch (err) {
    console.log(err);
  }
};

// Find a random brand.
BrandSchema.statics.getRandom = async function() {
  try {
    // Count all the brands.
    const count = await Brand.countDocuments().exec();
    if (count === 0) {
      // Create default brands.
      await Brand.insertDefaultBrands();
    }
    // Returns a document after skipping a random amount.
    const random = Math.floor(Math.random() * count);
    return Brand.findOne().skip(random).exec();
  } catch (err) {
    console.log(err);
  }
};

// Create a few default brands for the platform to simulate contracts.
BrandSchema.statics.insertDefaultBrands = async function() {
  try {
    const data = [{
      clientEmail: 'bozotheclient@abh.com',
      tribeEmail: 'bozo@tribedynamics.com',
      name: 'Anastasia Beverley Hills'
    }, {
      clientEmail: 'gonzotheclient@gucci.com',
      tribeEmail: 'gonzo@tribedynamics.com',
      name: 'Gucci (US)'
    }, {
      clientEmail: 'gonzotheclient@gucciuk.com',
      tribeEmail: 'gonzo@tribedynamics.com',
      name: 'Gucci (UK)'
    } ];
    for (let object of data) {
      const brand = new Brand(object);
      // Create a Stripe account for each of the brands.
      const customer = await stripe.customers.create({
        email: brand.clientEmail,
        description: brand.displayName()
      });
      brand.stripeCustomerId = customer.id;
      await brand.save();
    }
  } catch (err) {
    console.log(err);
  }
};

const Brand = mongoose.model('Brand', BrandSchema);

module.exports = Brand;
