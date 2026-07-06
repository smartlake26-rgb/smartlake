// ============================================================
//  features/ownership/ownership.js — Egalik validatsiyasi (SOF)
//  DOM/Firebase'siz -> test-oson. Transfer uchun ham shu mantiq
//  qayta ishlatiladi (kelajakda ownership transfer).
// ============================================================

export function isDeviceOwner(device, uid) {
  return !!device && !!uid && device.ownerUid === uid;
}

export function isLakeOwner(lake, uid) {
  return !!lake && !!uid && lake.ownerUid === uid;
}

/** Qurilma claim qilinishi mumkinmi (egasiz + provisioned)? */
export function isClaimable(device) {
  return !!device && (device.ownerUid == null) && device.lifecycle === 'provisioned';
}

export default { isDeviceOwner, isLakeOwner, isClaimable };
