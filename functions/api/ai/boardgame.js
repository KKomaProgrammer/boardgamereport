import { json } from '../../_lib/response.js';

export async function onRequest() {
  return json({ error: '이 기능은 현재 사용하지 않습니다.' }, 410);
}
