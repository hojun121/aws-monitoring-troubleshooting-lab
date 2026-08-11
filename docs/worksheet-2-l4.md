# 워크시트 2 — L4: 화면은 뜨는데 API가 죽음

## 증상

- `CloudFrontURL` 을 열면 **화면은 뜬다** (히어로 섹션, 애니메이션 전부 정상)
- 하지만 LIVE STATUS 패널이 빨갛고, 응답에 **10초 이상** 걸리다가 실패한다
- 상태코드 **504** (Gateway Timeout)

## 생각해볼 것

화면이 뜬다 = CloudFront → pub-ALB → next.js 까지는 정상.
그럼 끊긴 곳은 next.js **뒤쪽**: pri-ALB → node.js → RDS 구간이다.

**504(timeout)의 의미**: 연결 시도에 *응답 자체가 없음*. 문을 두드렸는데 아무 소리도 안 남.
(비교 — 502/refused: "거기 아무도 안 살아요"라고 즉답이 옴. 이 차이는 워크시트 3에서 다시 만납니다)

## 진단 순서

1. frontend EC2에 SSM 접속 ([02. SSM 가이드](02-ssm-access.md)):
   ```bash
   aws ssm start-session --target <FrontendInstanceId>
   ```
2. 내부 ALB를 직접 호출:
   ```bash
   curl -m 15 -i http://<PriAlbDns>/api/health     # 10초+ 걸리다 504
   ```
3. EC2 콘솔 → Target Groups → `*-api-tg` → **Targets 탭**: 타깃 상태는?
4. api EC2 로 직접 텔넷 (frontend EC2에서, api의 프라이빗 IP는 EC2 콘솔에서):
   ```bash
   timeout 5 bash -c 'cat < /dev/null > /dev/tcp/<api-private-ip>/3000' && echo OPEN || echo "TIMEOUT/CLOSED"
   ```
   → 타임아웃. **연결이 조용히 버려지고 있다.** 무엇이 패킷을 버릴까?
5. api EC2 의 **Security Group** 인바운드 규칙을 열어보세요. 뭐가 보이나요? (혹은, 뭐가 *안* 보이나요?)
6. 다른 SG(`*-sg-frontend`)의 인바운드와 비교 — 이 아키텍처의 SG 체이닝 규칙:
   **각 계층은 바로 앞 계층의 SG로부터만 허용한다**

## 수리 원칙

> api SG에 인바운드 규칙 **추가** — 포트 3000, Source는 CIDR이 아니라 **pri-ALB의 SG ID**

## 고쳤다면 — 확인

- 1~2분 내 브라우저 화면의 API 상태가… 어라, 아직도 죽어있다? **정상입니다. 워크시트 3으로.**

## 모니터링 데이터에서 흔적 찾기

- **VPC Flow Logs**: 고치기 **전** ALB→api:3000 시도가 `REJECT` 로 찍혀 있습니다.
  CloudWatch Logs Insights 에서:
  ```
  fields @timestamp, @message
  | filter @message like /REJECT/ and @message like /3000/
  | sort @timestamp desc | limit 20
  ```
- **CloudTrail**: 내가 방금 추가한 규칙 = `AuthorizeSecurityGroupIngress`.
  Event history에서 찾아서 userIdentity(누가), 시각(언제)을 확인해보세요.
  **"어제까지 됐는데 오늘 안 돼요"의 답이 항상 여기 있습니다.**

막히면: [해답](solutions/solution-2.md)
