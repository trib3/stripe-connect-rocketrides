'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Contract schema.
const ContractSchema = new Schema({
  ambassador: { type : Schema.ObjectId, ref : 'Pilot', required: true },
  brand: { type : Schema.ObjectId, ref : 'Passenger', required: true },
  postLink: { type: String, required: true },
  amount: Number,
  created: { type: Date, default: Date.now },

  // Stripe Payment Intent ID corresponding to this contract.
  stripePaymentIntentId: String
});

const Contract = mongoose.model('Contract', ContractSchema);

module.exports = Contract;
