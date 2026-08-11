# 해답 4 : 탐정 ⚠️ 스포일러

## 범인

`apps/api/server.js` 의 **카오스 미들웨어**. 모든 `/api/*` 요청(단, `/api/health` 제외)에 대해:

- 5% 확률 → 즉시 **HTTP 500**
- 10% 확률 → **3초 지연** 후 정상 처리

```js
const roll = Math.random() * 100;
if (roll < CHAOS_ERROR_PCT) { ... 500 ... }
if (roll < CHAOS_ERROR_PCT + CHAOS_DELAY_PCT) { ... setTimeout(next, 3000) ... }
```

`/api/health`를 제외한 이유 : 헬스체크는 항상 통과시켜서
**"모니터링은 초록불인데 사용자는 고통받는"** 상황을 만들기 위해서다.
실무에서 이 패턴은 흔하다: 헬스체크는 가벼운 경로만 확인하고, 진짜 버그는 비즈니스 로직에 산다.

앱 로그를 자세히 봤다면 단서가 있었다 : 요청 로그의 `"chaos":"delay"` / `"chaos":"error"` 필드.

## 이 시나리오의 진짜 목적

메트릭(p99) & 액세스 로그(target_processing_time) & 앱 로그로 **무엇이 & 얼마나 & 어디서**까지는
잡을 수 있음을 체험하는 것. 그리고 "앱 안의 **왜**"는 이 도구들로 답할 수 없음을 체감하는 것.

그 "왜"에 답하는 도구가 APM(트레이싱)이고, 다음 강의의 주제다.
(이번엔 코드를 열어봐서 범인을 알았지만 : 코드가 수십만 줄이라면?)

## 참고 : 카오스 조절 (멘토용)

systemd 유닛에 환경변수를 추가하면 확률 & 지연을 바꿀 수 있다:

```bash
# 예: 지연 30%로 올려서 데모를 극적으로
sudo systemctl edit lab-api    # [Service] Environment=CHAOS_DELAY_PCT=30
sudo systemctl restart lab-api
```
