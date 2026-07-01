const enc = new TextEncoder();
const dec = new TextDecoder();
function b64(bytes) {
  let bin = ''; const arr = new Uint8Array(bytes);
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s) {
  const bin = atob(s); const arr = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return arr;
}
async function keyFromSecret(secret) {
  if (!secret || secret.length < 32) throw new Error('APP_SECRET은 32자 이상으로 설정해야 합니다.');
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
}
export async function encryptJson(env, value) {
  const key = await keyFromSecret(env.APP_SECRET);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = enc.encode(JSON.stringify(value ?? {}));
  const cipher = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, plain);
  return `${b64(iv)}.${b64(cipher)}`;
}
export async function decryptJson(env, packed) {
  if (!packed) return null;
  const [iv64, ct64] = String(packed).split('.');
  const key = await keyFromSecret(env.APP_SECRET);
  const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv: fromB64(iv64) }, key, fromB64(ct64));
  return JSON.parse(dec.decode(plain));
}
