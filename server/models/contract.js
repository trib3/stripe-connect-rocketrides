'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Use native promises.
mongoose.Promise = global.Promise;

// Define the Contract schema.
const ContractSchema = new Schema({
  ambassador: { type : Schema.ObjectId, ref : 'Ambassador', required: true },
  brand: { type : Schema.ObjectId, ref : 'Brand', required: true },
  postLink: { type: String, required: true },
  amount: Number,
  accepted : {type: Boolean, default: false},
  created: { type: Date, default: Date.now },

  // Stripe Payment Intent ID corresponding to this contract.
  stripePaymentIntentId: String,
  stripeTransferId: String
});

const Contract = mongoose.model('Contract', ContractSchema);

module.exports = Contract;
