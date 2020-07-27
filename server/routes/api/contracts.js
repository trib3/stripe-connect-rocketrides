'use strict';

const config = require('../../config');
const express = require('express');
const router = express.Router();
const Brand = require('../../models/brand');
const Contract = require('../../models/contract');

/* For this demo, we assume that we're always authenticating the
 * latest passenger. In a production app, you would also typically
 * have a user authentication system for passengers.
 */

/**
 * POST /api/rides
 *
 * Create a new ride with the corresponding parameters.
 */
router.post('/', async (req, res, next) => {
  /* Important: For this demo, we're trusting the `amount` and `currency`
   * coming from the client request.
   * A real application should absolutely ensure the `amount` and `currency`
   * are securely computed on the backend to make sure the user can't change
   * the payment amount from their web browser or client-side environment.
   */
  const info = req.body;

  console.log(info)

  try {
    const brand = await Brand.findOne({name: info.brandName});

    // Create a new contract
    const contract = new Contract({
      brand: brand.id,
      ambassadorEmail: info.ambassadorEmail,
      amount: info.amount,
      postLink: info.postLink
    });
    console.log(contract)
    // Save the ride
    await contract.save();

    // Return the ride info
    res.send({
      contract_brand: brand.displayName(),
      ambassadorEmail: info.ambassadorEmail,
      amount: info.amount,
    });
  } catch (err) {
    res.sendStatus(500);
    next(`Error adding token to customer: ${err.message || err}`);
  }
});

module.exports = router;
