# FinSight

## Project layout

- `frontend/` contains the React app, assets, and its npm scripts.
- `backend/` contains the Spring Boot API, the optional `node-auth/` OTP server, and `database/migrations/`.
- `backend/database/migrations/` contains Flyway SQL migrations. Maven packages these files into the Spring API at build time.
- Root `.env` contains local backend secrets; `frontend/.env` contains only React settings. Neither file should be committed.

The React frontend owns page rendering and user interactions; the Spring backend exposes authenticated APIs and delegates business rules and database access to its services.

## Configure and run

1. Copy `.env.example` to root `.env` and set your MySQL values and, optionally, password-reset delivery values.
2. Copy `frontend/.env.example` to `frontend/.env` and set the API URL.
3. Start the Spring API from `backend`:

   ```text
   mvn spring-boot:run
   ```

4. Start the React app from `frontend`:

   ```text
   npm install
   npm start
   ```

Open `http://localhost:3000`. Sign-up and sign-in use an email address or mobile number with a password; neither requires a verification code.

## Deploy to Render

The root `render.yaml` defines a React static site and a Spring Boot Docker web service. The API uses an external MySQL database; Render Blueprints do not provision MySQL.

1. Make sure this repository's `main` branch contains `render.yaml` and `backend/Dockerfile`.
2. In Render, choose **New > Blueprint**, connect `madhu-125/FinSight-PERSONAL-FINANCE`, and deploy the Blueprint from `main`.
3. Enter the external MySQL JDBC URL, username, and password when prompted. For TiDB Cloud, use the cluster's public endpoint on port `4000` and a JDBC URL such as `jdbc:mysql://<cluster-host>:4000/<database-name>?sslMode=VERIFY_IDENTITY&enabledTLSProtocols=TLSv1.2&serverTimezone=UTC`. Set the TiDB-provided username and password in the matching Render environment variables. Ensure the named database exists and the cluster accepts connections from Render.
   - If deploying the Blueprint has already completed, add or update `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` under the API service's **Environment** settings, then redeploy. Keep credentials in Render or your local ignored `.env` file; never commit them or paste them into chat.
4. Password-based sign-up and sign-in do not need email or SMS delivery. To enable password recovery, add `RESEND_API_KEY` and a Resend-verified `RESEND_FROM_EMAIL` for email, or Twilio credentials for mobile, to the API service's environment.
5. Wait for both services to deploy. The frontend build receives the API hostname from the Blueprint; the API receives the frontend hostname for CORS and OAuth redirects.

The Blueprint generates `OTP_SECRET` and enables secure session cookies for HTTPS. Keep `OTP_CONSOLE_DELIVERY_ENABLED` and `DEMO_AUTH_ENABLED` set to `false` in production. Free Render services may spin down when idle, so the first request after inactivity can take longer.

Email OTP delivery for password resets requires a valid `RESEND_API_KEY` and a sender address verified by Resend in the root `.env`. Mobile password-reset codes require `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`. Restart the Spring API after changing these values. For local-only reset testing without delivery-provider credentials, `OTP_CONSOLE_DELIVERY_ENABLED=true` logs codes in the backend console; never enable this in production.

The backend Google OAuth integration requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the root `.env`; register `http://localhost:8080/login/oauth2/code/google` as an authorized redirect URI in Google Cloud. Social sign-in buttons are currently hidden from the UI.

For mobile password-reset codes, configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` in the root `.env`, then restart the Spring API. These values must come from a Twilio account with SMS enabled; do not commit or share them.

The optional Node server supports OTP authentication but not finance data storage. Use the Spring API for finance endpoints.

## Sign-in and profile

Sign-up creates the account directly with an email address or mobile number and password; no contact verification is required. Passwords must be at least 8 characters and no more than 72 UTF-8 bytes. Sign-in uses that password without an OTP. **Forgot password?** sends a one-time reset code to the registered contact. Profile name, age, gender, mobile contact, and address are stored with the signed-in account; the editable profile mobile is separate from the sign-in email or phone. Photos and notification preferences remain local to the browser. Photos can be uploaded or taken as a selfie, resized, and reframed in Profile.

Budgets can be created as weekly, monthly, or fixed two-month periods. On the Budgets page, choose a period and download a PDF containing the saved budgets of that frequency.
Transaction reports can be downloaded as a selected day, week, or month. Selfies use the browser camera when available; uploaded photos remain an alternative.

## Database and tests

Transactions, accounts, and budgets are stored per signed-in user in MySQL. Flyway migrations live in `backend/database/migrations/` and are bundled with the Spring API; you do not need to run them manually.

- Frontend tests/build: run `npm test -- --watchAll=false` or `npm run build` from `frontend`.
- Node OTP server tests: run `npm run test:server` from `frontend`.
- Spring API tests: run `mvn test` from `backend` (uses an isolated H2 database).

Never commit `.env` files or share their values. Phone numbers must include the country code in E.164 format, such as `+14155550123`. OTP codes expire after 10 minutes, can be resent after 60 seconds, and allow five verification attempts.

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
