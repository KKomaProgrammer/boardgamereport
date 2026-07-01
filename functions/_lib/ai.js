import { cleanText } from './response.js';
export async function generateSuggestion(env, task, text) {
  const content = cleanText(text, 6000);
  if (env.AI_ENDPOINT && env.AI_API_KEY) {
    const res = await fetch(env.AI_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({ task, input: content })
    });
    if (!res.ok) throw new Error('AI 요청에 실패했습니다.');
    const data = await res.json();
    return data.suggestion || data.output || data.text || JSON.stringify(data).slice(0, 2000);
  }
  return `AI_ENDPOINT가 아직 연결되지 않았습니다.\n\n${task} 기준으로는 다음처럼 정리할 수 있습니다.\n- 핵심 목적을 한 문장으로 먼저 말하기\n- 규칙과 절차를 번호로 나누기\n- 발표용 문장은 짧게 만들기\n- 팀원이 적용 버튼을 눌렀을 때만 저장하기\n\n입력 일부: ${content.slice(0, 500)}`;
}
