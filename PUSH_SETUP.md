# Adey Bonda Push Notifications – Setup

This project now uses Firebase Cloud Messaging (FCM) for web push notifications. The Vercel `/api` functions use `firebase-admin`; never place the Admin private key in browser code.

## Events implemented

- Customer creates an order → Owner gets a push notification.
- Customer sends a message → Owner gets a push notification.
- Owner sends a message → That customer gets a push notification.
- Background notifications open the relevant page when tapped.

## 1. Public VAPID key

Open `push-config.js` and replace `PASTE_YOUR_PUBLIC_VAPID_KEY_HERE` with the PUBLIC VAPID key you copied from Firebase Console → Project settings → Cloud Messaging → Web Push certificates. The same public key is used in both projects.

## 2. Firebase Admin service account

Firebase Console → Project settings → Service accounts → Generate new private key. Keep the downloaded JSON private.

In each Vercel project add these Environment Variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`. In the Owner project also add `OWNER_JWT_SECRET` with a long random string. Redeploy after setting them.

## 3. Realtime Database rules

The safest setup is to let the server/admin SDK write push-token records and keep them unreadable to normal clients. Add rules for `/pushTokens` appropriate to your existing auth model; do not make Admin credentials or private service-account JSON available to the browser. The server functions bypass Realtime Database rules.

## 4. Enable FCM web support

In the Firebase/Google Cloud project, make sure the Firebase Cloud Messaging Registration API is enabled. The web app must be served over HTTPS.

## 5. First test

Deploy the Customer and Owner repositories separately. Open the Owner Vercel URL, sign in, press Enable notifications, and allow browser notifications. Then open the Customer URL, sign in, press Enable notifications, and allow notifications. Create a small test order and then send a message.
