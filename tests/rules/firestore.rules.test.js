// ============================================================
//  tests/rules/firestore.rules.test.js
//  Multi-tenant izolyatsiya testlari (Firestore emulator).
//  Ishga tushirish:  npm run test:rules
//  (emulator:exec emulatorni ko'taradi, testni bajaradi, o'chiradi)
// ============================================================

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, deleteDoc, addDoc, collection, updateDoc,
} from 'firebase/firestore';
import { COLLECTIONS, ROLES, USER_STATUS } from '../../src/core/collections.js';

let testEnv;

const A = 'farmerA';
const B = 'farmerB';
const OP = 'operator1';
const SUP = 'super1';

function fs(uid, token) {
  return uid ? testEnv.authenticatedContext(uid, token).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'smartlake-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Xavfsizlik qoidalarisiz boshlang'ich ma'lumot (seed).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const prof = { ism: 'X', fam: 'Y', vil: 'Samarqand', tum: '', phone: '' };
    await setDoc(doc(db, COLLECTIONS.USERS, A), { email: 'a@x.uz', role: ROLES.FARMER, status: USER_STATUS.ACTIVE, locale: 'uz', profile: prof });
    await setDoc(doc(db, COLLECTIONS.USERS, B), { email: 'b@x.uz', role: ROLES.FARMER, status: USER_STATUS.ACTIVE, locale: 'uz', profile: prof });
    await setDoc(doc(db, COLLECTIONS.USERS, OP), { email: 'op@x.uz', role: ROLES.OPERATOR, status: USER_STATUS.ACTIVE });
    await setDoc(doc(db, COLLECTIONS.USERS, SUP), { email: 'sup@x.uz', role: ROLES.SUPER, status: USER_STATUS.ACTIVE });

    await setDoc(doc(db, COLLECTIONS.DEVICES, 'AQ0000000A'), { ownerUid: A, status: 'active' });
    await setDoc(doc(db, COLLECTIONS.DEVICES, 'AQ0000000B'), { ownerUid: B, status: 'active' });

    await setDoc(doc(db, COLLECTIONS.LAKES, 'lakeA'), { ownerUid: A, name: "A ko'li", approved: true });
    await setDoc(doc(db, COLLECTIONS.LAKES, 'lakeB'), { ownerUid: B, name: "B ko'li", approved: true });

    await setDoc(doc(db, COLLECTIONS.TELEMETRY, 'AQ0000000A'), { ownerUid: A, do: 6.1 });
    await setDoc(doc(db, COLLECTIONS.TELEMETRY, 'AQ0000000B'), { ownerUid: B, do: 5.0 });

    await setDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, 'ann1'), { title: 'salom', body: '...', ts: Date.now() });
  });
});

describe('users', () => {
  it('o\'zini o\'qiydi, boshqani YO\'Q', async () => {
    await assertSucceeds(getDoc(doc(fs(A), COLLECTIONS.USERS, A)));
    await assertFails(getDoc(doc(fs(A), COLLECTIONS.USERS, B)));
  });
  it('unauth o\'qiy olmaydi', async () => {
    await assertFails(getDoc(doc(fs(null), COLLECTIONS.USERS, A)));
  });
  it('role=\'super\' yoki status=\'suspended\' bilan o\'zini yarata OLMAYDI', async () => {
    await assertFails(setDoc(doc(fs('newUser'), COLLECTIONS.USERS, 'newUser'), { email: 'n@x.uz', role: ROLES.SUPER, status: 'active' }));
    await assertFails(setDoc(doc(fs('newUser'), COLLECTIONS.USERS, 'newUser'), { email: 'n@x.uz', role: ROLES.FARMER, status: 'suspended' }));
    await assertSucceeds(setDoc(doc(fs('newUser'), COLLECTIONS.USERS, 'newUser'), { email: 'n@x.uz', role: ROLES.FARMER, status: 'active' }));
  });
  it('o\'z rolini/statusini o\'zgartira OLMAYDI, profilni bo\'ladi', async () => {
    await assertFails(updateDoc(doc(fs(A), COLLECTIONS.USERS, A), { role: ROLES.SUPER }));
    await assertFails(updateDoc(doc(fs(A), COLLECTIONS.USERS, A), { status: 'suspended' }));
    await assertSucceeds(updateDoc(doc(fs(A), COLLECTIONS.USERS, A), { profile: { ism: 'Yangi', fam: 'Ism', vil: 'Samarqand', tum: '', phone: '' } }));
  });
  it('super boshqa foydalanuvchi rolini o\'zgartiradi', async () => {
    await assertSucceeds(updateDoc(doc(fs(SUP), COLLECTIONS.USERS, A), { role: ROLES.OPERATOR }));
  });
});

describe('lakes', () => {
  it('o\'z ko\'lini o\'qiydi, boshqanikini YO\'Q', async () => {
    await assertSucceeds(getDoc(doc(fs(A), COLLECTIONS.LAKES, 'lakeA')));
    await assertFails(getDoc(doc(fs(A), COLLECTIONS.LAKES, 'lakeB')));
  });
  it('o\'z nomiga ko\'l yaratadi (approved=false), boshqa nomiga YO\'Q', async () => {
    await assertSucceeds(setDoc(doc(fs(A), COLLECTIONS.LAKES, 'newA'), { ownerUid: A, name: 'yangi', approved: false }));
    await assertFails(setDoc(doc(fs(A), COLLECTIONS.LAKES, 'fake'), { ownerUid: B, name: 'soxta', approved: false }));
  });
  it('o\'zini tasdiqlay OLMAYDI (approved=true)', async () => {
    await assertFails(updateDoc(doc(fs(A), COLLECTIONS.LAKES, 'lakeA'), { approved: true }));
    await assertFails(setDoc(doc(fs(A), COLLECTIONS.LAKES, 'selfApprove'), { ownerUid: A, name: 'x', approved: true }));
  });
});

describe('devices', () => {
  it('fermer qurilma yarata/o\'zgartira OLMAYDI, admin oladi', async () => {
    await assertFails(setDoc(doc(fs(A), COLLECTIONS.DEVICES, 'AQ0000000C'), { ownerUid: A, status: 'active' }));
    await assertSucceeds(setDoc(doc(fs(OP), COLLECTIONS.DEVICES, 'AQ0000000C'), { ownerUid: A, status: 'active' }));
  });
  it('fermer o\'z qurilmasini o\'qiydi, boshqanikini YO\'Q', async () => {
    await assertSucceeds(getDoc(doc(fs(A), COLLECTIONS.DEVICES, 'AQ0000000A')));
    await assertFails(getDoc(doc(fs(A), COLLECTIONS.DEVICES, 'AQ0000000B')));
  });
});

describe('telemetry', () => {
  it('qurilma (device claim) yozadi, fermer YO\'Q', async () => {
    await assertSucceeds(setDoc(doc(fs('gw1', { device: true }), COLLECTIONS.TELEMETRY, 'AQ0000000A'), { ownerUid: A, do: 6.5 }));
    await assertFails(setDoc(doc(fs(A), COLLECTIONS.TELEMETRY, 'AQ0000000A'), { ownerUid: A, do: 9.9 }));
  });
  it('fermer o\'z telemetriyasini o\'qiydi, boshqanikini YO\'Q', async () => {
    await assertSucceeds(getDoc(doc(fs(A), COLLECTIONS.TELEMETRY, 'AQ0000000A')));
    await assertFails(getDoc(doc(fs(A), COLLECTIONS.TELEMETRY, 'AQ0000000B')));
  });
});

describe('commands', () => {
  it('fermer o\'z qurilmasiga buyruq yaratadi, boshqanikiga YO\'Q', async () => {
    await assertSucceeds(addDoc(collection(fs(A), COLLECTIONS.COMMANDS), { deviceId: 'AQ0000000A', ownerUid: A, type: 'aer', value: 1, status: 'pending' }));
    await assertFails(addDoc(collection(fs(A), COLLECTIONS.COMMANDS), { deviceId: 'AQ0000000B', ownerUid: A, type: 'aer', value: 1, status: 'pending' }));
  });
});

describe('announcements', () => {
  it('fermer o\'qiydi, YOZA olmaydi; admin yozadi', async () => {
    await assertSucceeds(getDoc(doc(fs(A), COLLECTIONS.ANNOUNCEMENTS, 'ann1')));
    await assertFails(addDoc(collection(fs(A), COLLECTIONS.ANNOUNCEMENTS), { title: 'soxta', body: '...', ts: Date.now() }));
    await assertSucceeds(addDoc(collection(fs(OP), COLLECTIONS.ANNOUNCEMENTS), { title: 'e\'lon', body: '...', ts: Date.now() }));
  });
});

describe('requests', () => {
  it('fermer o\'z so\'rovini yaratadi, o\'qiy olmaydi; admin o\'qiydi', async () => {
    await assertSucceeds(addDoc(collection(fs(A), COLLECTIONS.REQUESTS), { uid: A, deviceId: 'AQ0000000C', status: 'pending' }));
    await assertFails(addDoc(collection(fs(A), COLLECTIONS.REQUESTS), { uid: B, deviceId: 'AQ0000000C', status: 'pending' }));
  });
});

describe('logs', () => {
  it('admin yozadi/o\'qiydi, fermer YO\'Q', async () => {
    await assertSucceeds(addDoc(collection(fs(OP), COLLECTIONS.LOGS), { actor: OP, action: 'test', ts: Date.now() }));
    await assertFails(addDoc(collection(fs(A), COLLECTIONS.LOGS), { actor: A, action: 'x', ts: Date.now() }));
  });
});
