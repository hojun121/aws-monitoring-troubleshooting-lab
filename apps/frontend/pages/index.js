import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import os from 'os';

export async function getServerSideProps() {
  // 이 블록은 next.js EC2에서 실행된다 — API 체인이 전부 죽어도 히어로는 뜬다.
  return {
    props: {
      ssrHost: os.hostname(),
      ssrTime: new Date().toISOString(),
    },
  };
}

const MAX_LOG = 20;

function useApiCall(pushLog) {
  return useCallback(
    async (path, options) => {
      const started = performance.now();
      try {
        const res = await fetch(path, options);
        const ms = Math.round(performance.now() - started);
        let body = null;
        try { body = await res.json(); } catch { /* non-json */ }
        pushLog({ path, status: res.status, ms });
        return { ok: res.ok, status: res.status, ms, body };
      } catch {
        const ms = Math.round(performance.now() - started);
        pushLog({ path, status: 'ERR', ms });
        return { ok: false, status: 'ERR', ms, body: null };
      }
    },
    [pushLog]
  );
}

function LatencyBadge({ ms, status }) {
  if (ms == null) return <span className="badge idle">—</span>;
  const cls = status === 'ERR' || status >= 500 ? 'bad' : ms >= 1000 ? 'slow' : ms >= 300 ? 'warn' : 'good';
  return <span className={`badge ${cls}`}>{ms}ms</span>;
}

function StatusDot({ state }) {
  return <span className={`dot ${state}`} />;
}

function HexMesh() {
  // 헥사곤 노드 + 노드 사이를 흐르는 패킷 애니메이션 (순수 SVG)
  const paths = [
    'M 120 210 L 330 120 L 560 200 L 780 110',
    'M 60 90 L 280 190 L 520 90 L 760 190 L 900 120',
    'M 200 40 L 420 150 L 660 60 L 860 170',
  ];
  return (
    <svg className="mesh" viewBox="0 0 960 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#00e0c6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff4ecd" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="node" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9df3e4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00e0c6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {paths.map((d, i) => (
        <path key={`p${i}`} d={d} className="meshPath" style={{ animationDelay: `${i * 1.3}s` }} />
      ))}
      {[[120, 210], [330, 120], [560, 200], [780, 110], [60, 90], [280, 190], [520, 90], [760, 190], [200, 40], [660, 60], [860, 170], [900, 120]].map(([x, y], i) => (
        <g key={`n${i}`}>
          <circle cx={x} cy={y} r="16" fill="url(#node)" className="nodeGlow" style={{ animationDelay: `${(i % 5) * 0.8}s` }} />
          <circle cx={x} cy={y} r="3.5" fill="#bfeee6" />
        </g>
      ))}
      {paths.map((d, i) => (
        <circle key={`pk${i}`} r="4" className="packet">
          <animateMotion dur={`${5 + i * 1.7}s`} repeatCount="indefinite" path={d} />
        </circle>
      ))}
    </svg>
  );
}

export default function Home({ ssrHost, ssrTime }) {
  const [health, setHealth] = useState({ state: 'wait', ms: null, status: null, db: null });
  const [meta, setMeta] = useState(null);
  const [metaMs, setMetaMs] = useState(null);
  const [messages, setMessages] = useState(null);
  const [msgError, setMsgError] = useState(null);
  const [calls, setCalls] = useState([]);
  const [form, setForm] = useState({ author: '', content: '' });
  const [posting, setPosting] = useState(false);
  const seq = useRef(0);

  const pushLog = useCallback((entry) => {
    setCalls((prev) => [{ ...entry, id: seq.current++, t: new Date() }, ...prev].slice(0, MAX_LOG));
  }, []);
  const call = useApiCall(pushLog);

  const refreshStatus = useCallback(async () => {
    const h = await call('/api/health');
    setHealth({
      state: h.ok ? 'ok' : 'down',
      ms: h.ms,
      status: h.status,
      db: h.body?.db || null,
    });
    const m = await call('/api/meta');
    if (m.ok) setMeta(m.body);
    setMetaMs(m.ms);
  }, [call]);

  const refreshMessages = useCallback(async () => {
    const r = await call('/api/messages');
    if (r.ok && Array.isArray(r.body)) {
      setMessages(r.body);
      setMsgError(null);
    } else {
      setMsgError(r.status);
    }
  }, [call]);

  useEffect(() => {
    refreshStatus();
    refreshMessages();
    const t = setInterval(refreshStatus, 5000);
    return () => clearInterval(t);
  }, [refreshStatus, refreshMessages]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.author.trim() || !form.content.trim() || posting) return;
    setPosting(true);
    const r = await call('/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setPosting(false);
    if (r.ok) {
      setForm({ author: form.author, content: '' });
      refreshMessages();
    }
  };

  const chainState = health.state === 'wait' ? 'wait' : health.state === 'ok' ? 'ok' : 'down';

  return (
    <>
      <Head>
        <title>HOYA CLOUD · Mission Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assets/logo.svg" />
      </Head>

      <div className="aurora" aria-hidden="true">
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      </div>

      <main>
        {/* ============ HERO (SSR — API가 죽어도 항상 렌더링) ============ */}
        <section className="hero">
          <HexMesh />
          <div className="heroInner">
            <span className="pill">LIVE INFRASTRUCTURE LAB</span>
            <h1>
              HOYA <span className="grad">CLOUD</span>
            </h1>
            <p className="tagline">Mission Control — 패킷의 여정을 관제한다</p>
            <p className="ssrProof">
              rendered by <code>{ssrHost}</code> · {ssrTime} · <b>SSR</b>
            </p>
            <div className="chainMap">
              <span>CloudFront</span><i>→</i>
              <span>pub-ALB</span><i>→</i>
              <span className="me">next.js</span><i>→</i>
              <span className={chainState === 'ok' ? 'live' : chainState === 'down' ? 'dead' : ''}>pri-ALB</span><i>→</i>
              <span className={chainState === 'ok' ? 'live' : chainState === 'down' ? 'dead' : ''}>node.js</span><i>→</i>
              <span className={health.db === 'connected' ? 'live' : chainState === 'down' ? 'dead' : ''}>RDS</span>
            </div>
          </div>
          <div className="scrollHint">▼</div>
        </section>

        {/* ============ 라이브 상태 패널 ============ */}
        <section className="panel">
          <h2><span className="grad">LIVE</span> STATUS</h2>
          <p className="sub">5초마다 내부 API 체인을 호출합니다 — 응답 시간과 상태코드를 그대로 보여줍니다</p>

          <div className="cards">
            <div className={`card ${chainState}`}>
              <header>
                <h3>API 체인</h3>
                <LatencyBadge ms={health.ms} status={health.status} />
              </header>
              <div className="big">
                <StatusDot state={chainState} />
                {chainState === 'wait' ? '확인 중…' : chainState === 'ok' ? 'OPERATIONAL' : `DOWN (${health.status})`}
              </div>
              <footer>/api/health · next.js → pri-ALB → node.js</footer>
            </div>

            <div className={`card ${health.db === 'connected' ? 'ok' : chainState === 'down' ? 'down' : 'wait'}`}>
              <header><h3>DATABASE</h3></header>
              <div className="big">
                <StatusDot state={health.db === 'connected' ? 'ok' : chainState === 'down' ? 'down' : 'wait'} />
                {health.db === 'connected' ? 'CONNECTED' : chainState === 'down' ? 'UNREACHABLE' : '확인 중…'}
              </div>
              <footer>RDS MySQL · node.js가 보고하는 연결 상태</footer>
            </div>

            <div className={`card ${meta ? 'ok' : 'wait'}`}>
              <header>
                <h3>ORIGIN SERVER</h3>
                <LatencyBadge ms={metaMs} status={meta ? 200 : 'ERR'} />
              </header>
              {meta ? (
                <ul className="kv">
                  <li><b>host</b>{meta.hostname}</li>
                  <li><b>ip</b>{meta.privateIp || '—'}</li>
                  <li><b>az</b>{meta.az || '—'}</li>
                  <li><b>port</b>{meta.port}</li>
                </ul>
              ) : (
                <div className="big"><StatusDot state="wait" />응답 대기…</div>
              )}
              <footer>/api/meta · 응답한 node.js 서버의 정체</footer>
            </div>
          </div>

          <div className="trafficLog">
            <header>
              <h3>TRAFFIC LOG</h3>
              <span className="sub">최근 {MAX_LOG}건 — ALB 액세스 로그의 미리보기</span>
            </header>
            <div className="rows">
              {calls.length === 0 && <div className="row empty">아직 호출 없음</div>}
              {calls.map((c) => (
                <div key={c.id} className={`row ${c.status === 'ERR' || c.status >= 500 ? 'bad' : c.ms >= 1000 ? 'slow' : ''}`}>
                  <span className="t">{c.t.toLocaleTimeString('ko-KR', { hour12: false })}</span>
                  <span className="p">{c.path}</span>
                  <span className="s">{c.status}</span>
                  <span className="m">{c.ms}ms</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ 메시지 보드 (RDS 왕복 증명) ============ */}
        <section className="panel">
          <h2>MESSAGE <span className="grad">BOARD</span></h2>
          <p className="sub">글이 등록되면 CloudFront부터 RDS까지 전 구간이 뚫렸다는 뜻입니다</p>

          <form className="msgForm" onSubmit={submit}>
            <input
              placeholder="이름"
              value={form.author}
              maxLength={50}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
            />
            <input
              placeholder="메시지를 남겨보세요"
              value={form.content}
              maxLength={500}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <button disabled={posting}>{posting ? '전송 중…' : 'SEND'}</button>
          </form>

          <div className="msgList">
            {messages === null && msgError === null && <div className="msgEmpty">불러오는 중…</div>}
            {msgError !== null && (
              <div className="msgEmpty bad">
                메시지를 불러오지 못했습니다 (status: {String(msgError)}) — 체인 어딘가가 끊겨 있습니다
              </div>
            )}
            {Array.isArray(messages) && messages.map((m) => (
              <div key={m.id} className="msg">
                <span className="author">{m.author}</span>
                <span className="content">{m.content}</span>
                <span className="when">{new Date(m.created_at).toLocaleString('ko-KR', { hour12: false })}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="pageFoot">
          AWS Monitoring &amp; Troubleshooting Lab · 이 화면 자체가 실습 계기판입니다
        </footer>
      </main>
    </>
  );
}
