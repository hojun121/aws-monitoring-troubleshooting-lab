/**
 * AWS Monitoring & Troubleshooting Lab - Backend API
 *
 * - GET  /api/health    : 앱 + DB 상태 (ALB Target Group 헬스체크 대상, 카오스 제외)
 * - GET  /api/meta      : 이 서버의 hostname / private IP / AZ
 * - GET  /api/messages  : 메시지 목록 (MySQL)
 * - POST /api/messages  : 메시지 등록 (MySQL)
 *
 * 카오스 주입 (시나리오 4):
 *   CHAOS_DELAY_PCT (기본 10) : 해당 확률(%)로 CHAOS_DELAY_MS 만큼 지연
 *   CHAOS_ERROR_PCT (기본 5)  : 해당 확률(%)로 HTTP 500 반환
 *   /api/health 는 카오스 대상에서 제외 → 헬스체크는 항상 정상으로 보인다
 *
 * 로그: 모든 요청을 JSON 한 줄로 stdout 출력 (systemd가 파일로 저장,
 *       CloudWatch Agent가 수집)
 */
const express = require('express');
const mysql = require('mysql2/promise');
const os = require('os');
const http = require('http');

const PORT = parseInt(process.env.PORT || '3000', 10);
const CHAOS_DELAY_PCT = parseFloat(process.env.CHAOS_DELAY_PCT || '10');
const CHAOS_DELAY_MS = parseInt(process.env.CHAOS_DELAY_MS || '3000', 10);
const CHAOS_ERROR_PCT = parseFloat(process.env.CHAOS_ERROR_PCT || '5');

const DB = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER || 'labadmin',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'labdb',
  port: parseInt(process.env.DB_PORT || '3306', 10),
};

const app = express();
app.use(express.json());

// ---------------------------------------------------------------
// 구조화 로그
// ---------------------------------------------------------------
function log(level, event, extra) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, ...extra }));
}

// ---------------------------------------------------------------
// EC2 메타데이터 (IMDSv2) - 부팅 시 1회 조회 후 캐시
// ---------------------------------------------------------------
const meta = { hostname: os.hostname(), privateIp: null, az: null };

function imds(path, token) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: '169.254.169.254', path, method: token ? 'GET' : 'PUT', timeout: 1000,
        headers: token
          ? { 'X-aws-ec2-metadata-token': token }
          : { 'X-aws-ec2-metadata-token-ttl-seconds': '300' } },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve(b)); }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function loadMeta() {
  const token = await imds('/latest/api/token');
  if (!token) return;
  meta.privateIp = await imds('/latest/meta-data/local-ipv4', token);
  meta.az = await imds('/latest/meta-data/placement/availability-zone', token);
}

// ---------------------------------------------------------------
// DB 초기화: 연결될 때까지 재시도 → 테이블 생성 → 시드
// ---------------------------------------------------------------
let pool = null;
let dbReady = false;

const SEED = [
  ['system', '🚀 HOYA CLOUD Mission Control 가동 시작'],
  ['system', '이 메시지가 보인다면 API → RDS 체인이 정상입니다'],
  ['mentor', '트러블슈팅은 낮은 계층부터. ping → telnet → curl'],
];

async function initDb() {
  for (let attempt = 1; ; attempt++) {
    try {
      pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 5 });
      await pool.query('SELECT 1');
      await pool.query(`CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        author VARCHAR(50) NOT NULL,
        content VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM messages');
      if (n === 0) {
        for (const [author, content] of SEED) {
          await pool.query('INSERT INTO messages (author, content) VALUES (?, ?)', [author, content]);
        }
        log('info', 'db_seeded', { rows: SEED.length });
      }
      dbReady = true;
      log('info', 'db_ready', { host: DB.host, attempt });
      return;
    } catch (err) {
      log('warn', 'db_init_retry', { attempt, error: err.code || err.message });
      await new Promise((r) => setTimeout(r, Math.min(attempt * 2000, 15000)));
    }
  }
}

// ---------------------------------------------------------------
// 요청 로깅 + 카오스 미들웨어 (/api/health 제외)
// ---------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.locals.chaos = null;
  res.on('finish', () => {
    log('info', 'request', {
      method: req.method, path: req.path, status: res.statusCode,
      ms: Date.now() - start, chaos: res.locals.chaos,
    });
  });
  next();
});

app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  const roll = Math.random() * 100;
  if (roll < CHAOS_ERROR_PCT) {
    res.locals.chaos = 'error';
    return res.status(500).json({ error: 'internal server error', hint: '왜 실패했을까요? 로그와 메트릭만으로 원인이 보이나요?' });
  }
  if (roll < CHAOS_ERROR_PCT + CHAOS_DELAY_PCT) {
    res.locals.chaos = 'delay';
    return setTimeout(next, CHAOS_DELAY_MS);
  }
  next();
});

// ---------------------------------------------------------------
// 엔드포인트
// ---------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  if (!dbReady) return res.status(503).json({ status: 'starting', db: 'connecting' });
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

app.get('/api/meta', (req, res) => {
  res.json({ ...meta, port: PORT, uptimeSec: Math.floor(process.uptime()) });
});

app.get('/api/messages', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'db not ready' });
  try {
    const [rows] = await pool.query(
      'SELECT id, author, content, created_at FROM messages ORDER BY id DESC LIMIT 30'
    );
    res.json(rows);
  } catch (err) {
    log('error', 'db_query_failed', { error: err.code || err.message });
    res.status(500).json({ error: 'db query failed' });
  }
});

app.post('/api/messages', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'db not ready' });
  const author = String(req.body.author || '').trim().slice(0, 50);
  const content = String(req.body.content || '').trim().slice(0, 500);
  if (!author || !content) return res.status(400).json({ error: 'author and content required' });
  try {
    const [r] = await pool.query('INSERT INTO messages (author, content) VALUES (?, ?)', [author, content]);
    res.status(201).json({ id: r.insertId, author, content });
  } catch (err) {
    log('error', 'db_insert_failed', { error: err.code || err.message });
    res.status(500).json({ error: 'db insert failed' });
  }
});

app.use((req, res) => res.status(404).json({ error: 'not found' }));

// ---------------------------------------------------------------
app.listen(PORT, () => {
  log('info', 'server_started', {
    port: PORT,
    chaos: { delayPct: CHAOS_DELAY_PCT, delayMs: CHAOS_DELAY_MS, errorPct: CHAOS_ERROR_PCT },
  });
  loadMeta();
  initDb();
});
