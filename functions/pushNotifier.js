// ============================================================
//  functions/pushNotifier.js — Firebase Cloud Function
//  RTDB'da ogohlantirish kelganda fermerga push yuboradi
//
//  DEPLOY: firebase deploy --only functions
//  Bu fayl Cloud Functions (Node.js) muhitida ishlaydi.
//
//  TRIGGER:
//    RTDB: /nodes/{deviceId}/latest → do < kritik → push
//    Firestore: /requests/{id} → yangi claim → admin push
// ============================================================

const { onValueWritten } = require('firebase-functions/v2/database');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');

initializeApp();
const db = getFirestore();

// ---- 1. Sensor ogohlantirish (DO kritik) ----
exports.sensorAlert = onValueWritten(
  { ref: '/nodes/{deviceId}/latest', region: 'europe-west1' },
  async (event) => {
    const after = event.data.after.val();
    if (!after) return;

    const deviceId = event.params.deviceId;
    const doVal = after.do;
    const temp  = after.t;

    // Kritik holatlar
    const alerts = [];
    if (typeof doVal === 'number' && doVal > 0 && doVal < 3) {
      alerts.push({ title: '🚨 Kislorod KRITIK!', body: `${deviceId}: DO = ${doVal} mg/L — aeratorni darhol yoqing!` });
    }
    if (typeof temp === 'number' && temp > 35) {
      alerts.push({ title: '🌡️ Harorat juda yuqori!', body: `${deviceId}: ${temp}°C — baliq xavf ostida!` });
    }

    if (!alerts.length) return;

    // Qurilma egasini topish
    const devSnap = await db.collection('devices').doc(deviceId).get();
    if (!devSnap.exists) return;
    const ownerUid = devSnap.data().ownerUid;
    if (!ownerUid) return;

    // Foydalanuvchi FCM tokenini olish
    const userSnap = await db.collection('users').doc(ownerUid).get();
    if (!userSnap.exists) return;
    const fcmToken = userSnap.data().fcmToken;
    if (!fcmToken) return;

    // Push yuborish
    for (const alert of alerts) {
      try {
        await getMessaging().send({
          token: fcmToken,
          notification: { title: alert.title, body: alert.body },
          data: {
            type: 'sensor_alert',
            deviceId,
            lakeId: devSnap.data().lakeId || '',
            tag: `alert-${deviceId}`,
            url: '/',
          },
          android: { priority: 'high', notification: { sound: 'default', channelId: 'alerts' } },
          webpush: { notification: { icon: '/favicon.svg', badge: '/favicon.svg', vibrate: [200, 100, 200] } },
        });
        console.log(`Push yuborildi: ${ownerUid} ← ${alert.title}`);
      } catch (e) {
        console.error('Push xato:', e.message);
        // Token eskirgan bo'lsa tozalash
        if (e.code === 'messaging/registration-token-not-registered') {
          await db.collection('users').doc(ownerUid).update({ fcmToken: null, pushEnabled: false });
        }
      }
    }
  }
);

// ---- 2. Yangi claim so'rovi — admin push ----
exports.claimNotify = onDocumentCreated(
  { document: 'requests/{requestId}', region: 'europe-west1' },
  async (event) => {
    const data = event.data.data();
    if (!data) return;

    // Barcha admin'larga push
    const admins = await db.collection('users')
      .where('role', 'in', ['super', 'operator'])
      .where('pushEnabled', '==', true)
      .get();

    const tokens = admins.docs
      .map((d) => d.data().fcmToken)
      .filter(Boolean);

    if (!tokens.length) return;

    const msg = {
      notification: {
        title: '📱 Yangi qurilma so\'rovi',
        body: `${data.farmerName || 'Fermer'} ${data.deviceId} qurilmasini ulashni so'ramoqda`,
      },
      data: { type: 'claim_request', deviceId: data.deviceId || '', tag: 'claim' },
    };

    // Har bir tokonga yuborish
    for (const token of tokens) {
      try {
        await getMessaging().send({ ...msg, token });
      } catch (e) {
        console.error('Admin push xato:', e.message);
      }
    }
  }
);
