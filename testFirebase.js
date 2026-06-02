// testFirebase.js
const { db } = require("./config/firebase");

async function test() {
  const ref = db.ref("delivery_partners");
  const snapshot = await ref.once("value");
  console.log(snapshot.val());
}

test();
