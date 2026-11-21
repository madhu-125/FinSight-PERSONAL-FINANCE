# FinSight

## Run locally with email or SMS OTP

The OTP flow uses a small Node.js authentication server, Resend for email, and Twilio for SMS. Use Node.js 20.6 or newer.

1. Copy `.env.example` to `.env`.
2. Set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` from Resend.
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` from Twilio. The Twilio number must be able to send SMS.
4. Generate an `OTP_SECRET` locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the result in `.env`.
5. Run `npm run server` in one terminal and `npm start` in another.

Never commit `.env` or share its values. Phone numbers must include the country code in E.164 format, such as `+14155550123`. OTP codes expire after 10 minutes, can be resent after 60 seconds, and allow five verification attempts.

The existing password form is still a demo and is not checked against a user database; OTP verifies access to the selected email address or phone number. Add a real user store before using this as production authentication.

For local UI demos only, set both `REACT_APP_DEMO_AUTH=true` and `DEMO_AUTH_ENABLED=true` in `.env` to let sign-in continue with any entered email/phone and password without OTP. The backend demo-session endpoint is disabled by default; keep both flags `false` when testing OTP or deploying.

## MySQL-backed transactions

Transactions, accounts, and monthly budgets are saved to the signed-in user's MySQL account. Transaction details include description, amount, type, category, and date; accounts use name, type, and balance; budgets use category, monthly limit, and month. Set `REACT_APP_API_URL=http://localhost:8080`, configure the database values in `.env`, and start the Spring API from `backend` with `mvn spring-boot:run` before starting React. These list and create requests require an authenticated session. To use the Node OTP server instead, leave `REACT_APP_API_URL` empty and run `npm run server`; that server does not include transaction, account, or budget storage.

## Available Scripts

`npm start` runs the web app. `npm run server` runs the OTP API. `npm test -- --watchAll=false` runs the React tests, and `npm run test:server` runs the authentication API tests.

## Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
