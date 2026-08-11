/**
 * BFF 프록시: 브라우저의 /api/* 요청을 내부 API 체인(pri-ALB)으로 전달한다.
 *
 *   브라우저 → CloudFront → pub-ALB → [이 서버] → pri-ALB → node.js API
 *
 * API_ORIGIN 환경변수(예: internal-pri-alb-xxx.ap-northeast-2.elb.amazonaws.com)
 * 는 CloudFormation UserData가 systemd 유닛에 주입한다.
 *
 * 타임아웃 15초: pri-ALB가 타깃 연결 실패로 504를 돌려줄 시간(≈10초)을
 * 기다려준다. 여기서 먼저 끊어버리면 학생이 504와 502를 구분할 수 없다.
 */
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const origin = process.env.API_ORIGIN;
  if (!origin) {
    return res.status(500).json({ error: 'API_ORIGIN not configured on frontend server' });
  }

  const path = Array.isArray(req.query.all) ? req.query.all.join('/') : req.query.all;
  const url = `http://${origin}/api/${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      signal: controller.signal,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'gateway timeout (frontend → internal API)' : 'bad gateway (frontend → internal API)',
      detail: err.cause?.code || err.name,
    });
  } finally {
    clearTimeout(timer);
  }
}
