# Stripe Payments with Tribe

Built on top of  [Stripe Connect Express](https://stripe.com/connect/express)

**You can try the web app live on [rocketrides.io](https://rocketrides.io).**

This purpose of this repository is to onboard influencers to get paid for content:
* [Web server in Node.js](#web-onboarding-for-pilots) to onboard influencers on the web and get them paid

## Influencer onboarding

This uses [Connect Express accounts](https://stripe.com/connect/account-types) to get influencers paid. We are using Stripe Express for a quick and easy interaction with Stripe.

Using Stripe gives us authenticity with influencers and allows Stripe to handle all of the data security side.

This platform also uses the Stripe API to create payments for influencers.

### Requirements

Tribe has a stripe account, ask Nick for details. 

You'll need to have [Node.js](http://nodejs.org) >= 7.x and [MongoDB](http://mongodb.org) installed to run this app.

### Getting started

Install dependencies using npm (or yarn):

    cd server
    npm install


Make sure MongoDB is running. If you're using Homebrew on macOS:

    # Install once
    brew tap mongodb/brew
    brew install mongodb-community 

    # Start
    brew services start mongodb-community

Run the app:

    npm start

Go to http://localhost:3000 in your browser to start using the app.


## Credits

* Forked From: [Stripe Example](https://github.com/stripe/stripe-connect-rocketrides)
