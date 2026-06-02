const admin = require("firebase-admin");
const serviceAccount = require("../firebaseServiceKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();
const fcm = admin.messaging();

module.exports = {
  admin,
  firestore,
  fcm,
};
