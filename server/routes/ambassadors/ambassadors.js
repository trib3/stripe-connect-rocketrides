'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const Ambassador = require('../../models/ambassador');
const Contract = require('../../models/contract');
const Brand = require('../../models/brand');
const ObjectId = require('mongodb').ObjectId;
const mongoose = require('mongoose');


// Middleware: require a logged-in pilot
function ambassadorRequired(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/ambassadors/login');
  }
  next();
}

/**
 * GET /ambassadors/dashboard
 *
 * Show the Dashboard for the logged-in pilot with the overview,
 * their contract history, and the ability to simulate a test contract.
 *
 * Use the `ambassadorRequired` middleware to ensure that only logged-in
 * ambassadors can access this route.
 */
router.get('/dashboard', ambassadorRequired, async (req, res) => {
  const ambassador = req.user;
  // Retrieve the balance from Stripe
  const balance = await stripe.balance.retrieve({
    stripe_account: ambassador.stripeAccountId,
  });
  // Fetch the pilot's recent rides
  const contracts = await ambassador.listRecentContracts();
  const contractsTotalAmount = contracts.reduce((a, b) => {
    return a + b;
  }, 0);
  const [showBanner] = req.flash('showBanner');
  res.render('dashboard', {
    ambassador: ambassador,
    balanceAvailable: balance.available[0].amount,
    balancePending: balance.pending[0].amount,
    contractsTotalAmount: contractsTotalAmount,
    contracts: contracts,
    showBanner: !!showBanner || req.query.showBanner,
  });
});

/**
 * POST /ambassadors/contracts
 *
 * Generate a test contract with sample data for the logged-in pilot.
 */
router.post('/contracts', ambassadorRequired, async (req, res, next) => {
  const ambassador = req.user;
  // Find a random brand
  const brand = await Brand.getRandom();
  // Create a new ride for the ambassador and this random brand
  const contract = new Contract({
    ambassadorEmail: ambassador.email,
    brand: brand.id,
    // Generate a random amount between $10 and $100 for this ride
    amount: getRandomInt(1000, 10000),
    postLink: 'https://www.instagram.com/p/CCrR7dtA3Ul/',
    accepted: false
  });
  // Save the ride
  await contract.save();
  res.redirect('/ambassadors/dashboard');
});


/**
 * POST /ambassadors/agree_terms
 *
 * Form which agrees terms and sends off stripe payments
 */
router.post('/accept_contract', ambassadorRequired, async (req, res, next) => {
  // Find a random brand
  const contractID = Object.assign({}, req.body).contractID;
  const contract = await Contract.findOne({_id: ObjectId(contractID)});
  const ambassador = await Ambassador.findOne({email: contract.ambassadorEmail})
  try {

    // const topup = await stripe.topups.create({
    //       amount: 2000,
    //       currency: "usd",
    //       source: 'btok_us_verified'
    //     }
    //   )
    // Create a charge and set its destination to the pilot's account
    const transfer = await stripe.charges.create({
      amount: contract.amount,
      currency: 'usd',
      description: contract.postLink,
      metadata: {'contractID': contract.id},
      destination: ambassador.stripeAccountId,
      source: 'btok_us_verified',
    });
    // Add the Stripe charge reference to the ride and save it
    contract.stripeTransferId = transfer.id;
    contract.accepted = true;
  } catch (err) {
    console.log(err);
    // Return a 402 Payment Required error code
    res.sendStatus(402);
    next(`Error adding token to customer: ${err.message}`);
  }
  // Save the contract
  await contract.save();
  res.redirect('/ambassadors/dashboard');
});

/**
 * GET /ambassadors/signup
 *
 * Display the signup form on the right step depending on the current completion.
 */
router.get('/signup', (req, res) => {
  let step = 'account';
  let displayName = '';
  console.log(req.user);
  // Naive way to identify which step we're on: check for the presence of user profile data
  if (req.user) {
    if (!req.user.firstName || !req.user.lastName) {
      step = 'profile';
    } else if (!req.user.stripeAccountId) {
      step = 'payments';
      displayName = req.user.displayName();
    } else {
      return res.redirect('/ambassadors/dashboard');
    }
  }
  res.render('signup', {step: step, displayName: displayName, ambassador: req.user});
});

/**
 * GET /ambassadors/terms_of_acceptance
 *
 * Display the terms of acceptance for accepting rights
 */
router.get('/terms_of_acceptance', ambassadorRequired, (req, res) => {
  res.render('contract-terms', {ambassador: req.user});
});

/**
 * POST /ambassadors/signup
 *
 * Create a user and update profile information during the ambassador onboarding process.
 */
router.post('/signup', async (req, res, next) => {
  const body = Object.assign({}, req.body);
  // Check if we have a logged-in pilot
  let ambassador = req.user;
  if (!ambassador) {
    try {
      // Try to create and save a new ambassador

      ambassador = new Ambassador(body);
      ambassador = await ambassador.save()
      // Sign in and redirect to continue the signup process
      req.logIn(ambassador, err => {
        if (err) next(err);
        if (err) next(err);
        return res.redirect('/ambassadors/signup');
      });
    } catch (err) {
      // Show an error message to the user
      const errors = Object.keys(err.errors).map(field => err.errors[field].message);
      res.render('signup', { step: 'account', error: errors[0] });
    }
  }
  else {
    try {
      // Try to update the logged-in ambassador using the newly entered profile data
      ambassador.set(body);
      await ambassador.save();
      return res.redirect('/account/stripe/authorize');
    } catch (err) {
      next(err);
    }
  }
});

/**
 * GET /ambassadors/login
 *
 * Simple pilot login.
 */
router.get('/login', (req, res) => {
  res.render('login');
});

/**
 * GET /ambassadors/login
 *
 * Simple ambassador login.
 */
router.post(
  '/login',
  passport.authenticate('ambassador-login', {
    successRedirect: '/ambassadors/dashboard',
    failureRedirect: '/ambassadors/login',
  })
);

/**
 * GET /ambassadors/logout
 *
 * Delete the pilot from the session.
 */
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

// Serialize the pilot's sessions for Passport
passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    let user = await Ambassador.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Define the login strategy for ambassadors based on email and password
passport.use('ambassador-login', new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  let user;
  try {
    user = await Ambassador.findOne({email});
    if (!user) {
      return done(null, false, { message: 'Unknown user' });
    }
  } catch (err) {
    return done(err);
  }
  if (!user.validatePassword(password)) {
    return done(null, false, { message: 'Invalid password' });
  }
  return done(null, user);
}));


// Return a random int between two numbers
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = router;
