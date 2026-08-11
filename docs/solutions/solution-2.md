# 해답 2 : L4 ⚠️ 스포일러

## 원인

api EC2의 Security Group(`<스택명>-sg-api`)에 **인바운드 규칙이 하나도 없다.**
pri-ALB가 3000 포트로 헬스체크 & 트래픽을 보내지만 SG가 전부 조용히 버린다(drop).
그래서 응답이 아예 없고(= timeout), pri-ALB는 10초 기다리다 **504**를 돌려준다.

## 수리

EC2 콘솔 → Security Groups → `<스택명>-sg-api` → Inbound rules → **Edit → Add rule**
- Type: Custom TCP, Port: `3000`
- Source: **Custom → `<스택명>-sg-pri-alb` 의 SG ID** (sg-xxxx 검색해서 선택)
- Save

> Source를 `0.0.0.0/0`이나 CIDR로 열어도 동작은 하지만, 이 아키텍처의 규칙은
> **SG 체이닝** : "바로 앞 계층의 SG로부터만". IP는 바뀌어도 SG 참조는 안 바뀐다.

## 확인

- Flow Logs에서 이후 트래픽이 ACCEPT로 바뀜
- 단, 화면은 아직 502 : **의도된 다음 고장** (워크시트 3)

## 교훈

- **timeout = 방화벽이 버리는 중** (SG/NACL부터), **refused = 프로세스가 없는 중** (서버 안부터)
- SG는 Stateful : 인바운드만 열면 응답은 자동
- 내 수리는 CloudTrail에 `AuthorizeSecurityGroupIngress`로 남는다 : 남의 수리도 마찬가지
