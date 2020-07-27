'use strict';

const config = require('../../config');
const stripe = require('stripe')(config.stripe.secretKey);
const request = require('request-promise-native');
const querystring = require('querystring');
const express = require('express');
const router = express.Router();

// Middleware that requires a logged-in pilot
function ambassadorRequired(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/ambassadors/login');
  }
  next();
}

/**
 * GET /account/stripe/authorize
 *
 * Redirect to Stripe to set up payments.
 */
router.get('/authorize', ambassadorRequired, (req, res) => {
  // Generate a random string as `state` to protect from CSRF and include it in the session
  req.session.state = Math.random()
    .toString(36)
    .slice(2);
  // Define the mandatory Stripe parameters: make sure to include our platform's client ID
  let parameters = {
    client_id: config.stripe.clientId,
    state: req.session.state,
  };
  // Optionally, the Express onboarding flow accepts `first_name`, `last_name`, `email`,
  // in the query parameters: those form fields will be prefilled
  parameters = Object.assign(parameters, {
    redirect_uri: config.publicDomain + '/account/stripe/token',
    'stripe_user[first_name]': req.user.firstName || undefined,
    'stripe_user[last_name]': req.user.lastName || undefined,
    'stripe_user[email]': req.user.email || undefined,
  });
  console.log('Starting Express flow:', parameters);
  // Redirect to Stripe to start the Express onboarding flow
  res.redirect(
    config.stripe.authorizeUri + '?' + querystring.stringify(parameters)
  );
});

/**
 * GET /account/stripe/token
 *
 * Connect the new Stripe account to the platform account.
 */
router.get('/token', ambassadorRequired, async (req, res, next) => {
  // Check the `state` we got back equals the one we generated before proceeding (to protect from CSRF)
  if (req.session.state != req.query.state) {
    return res.redirect('/ambassadors/signup');
  }
  try {
    // Post the authorization code to Stripe to complete the Express onboarding flow
    const expressAuthorized = await request.post({
      uri: config.stripe.tokenUri,
      form: {
        grant_type: 'authorization_code',
        client_id: config.stripe.clientId,
        client_secret: config.stripe.secretKey,
        code: req.query.code
      },
      json: true
    });

    if (expressAuthorized.error) {
      throw(expressAuthorized.error);
    }

    // Update the model and store the Stripe account ID in the datastore:
    // this Stripe account ID will be used to issue payouts to the pilot
    req.user.stripeAccountId = expressAuthorized.stripe_user_id;
    await req.user.save();

    // Redirect to the dashboard
    req.flash('showBanner', 'true');
    res.redirect('/ambassadors/dashboard');
  } catch (err) {
    console.log('The Stripe onboarding process has not succeeded.');
    next(err);
  }
});

/**
 * GET /account/stripe/dashboard
 *
 * Redirect to the ambassadors' Stripe Express dashboard to view payouts and edit account details.
 */
router.get('/dashboard', ambassadorRequired, async (req, res) => {
  const pilot = req.user;
  // Make sure the logged-in pilot completed the Express onboarding
  if (!pilot.stripeAccountId) {
    return res.redirect('/ambassadors/signup');
  }
  try {
    // Generate a unique login link for the associated Stripe account to access their Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(
      pilot.stripeAccountId, {
        redirect_url: config.publicDomain + '/ambassadors/dashboard'
      }
    );
    // Directly link to the account tab
    if (req.query.account) {
      loginLink.url = loginLink.url + '#/account';
    }
    // Retrieve the URL from the response and redirect the user to Stripe
    return res.redirect(loginLink.url);
  } catch (err) {
    console.log(err);
    console.log('Failed to create a Stripe login link.');
    return res.redirect('/ambassadors/signup');
  }
});

/**
 * POST /account/stripe/payout
 *
 * Generate an instant payout with Stripe for the available balance.
 */
router.post('/payout', ambassadorRequired, async (req, res) => {
  const pilot = req.user;
  try {
    // Fetch the account balance to determine the available funds
    const balance = await stripe.balance.retrieve({
      stripe_account: pilot.stripeAccountId,
    });
    // This demo app only uses USD so we'll just use the first available balance
    // (Note: there is one balance for each currency used in your application)
    const {amount, currency} = balance.available[0];
    // Create an instant payout
    const payout = await stripe.payouts.create(
      {
        amount: amount,
        currency: currency,
        statement_descriptor: config.appName,
      },
      {
        stripe_account: pilot.stripeAccountId,
      }
    );
  } catch (err) {
    console.log(err);
  }
  res.redirect('/ambassadors/dashboard');
});

module.exports = router;
