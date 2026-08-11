# 워크시트 3 : L7: 고쳤는데 또 죽음

## 증상

- SG를 고쳤는데 화면의 API 상태가 여전히 빨갛다
- 하지만 **에러가 달라졌다**: 10초 넘게 걸리던 504가 → **즉시 뜨는 502** (Bad Gateway)

## 생각해볼 것 : timeout vs refused

| | 워크시트 2 (전) | 지금 |
|---|---|---|
| 상태코드 | 504 | 502 |
| 걸린 시간 | 10초+ | 즉시 |
| 의미 | 패킷이 조용히 버려짐 → **방화벽(SG)** | "그 포트에 아무도 없어요"라고 즉답 → **프로세스가 없다** |

네트워크는 뚫렸습니다. 이제 문제는 서버 **안**에 있습니다. L7의 세계입니다.

## 진단 순서 (홉 단위 격리)

1. 바깥에서 안으로, 어느 홉에서 죽는지 확인:
   ```bash
   curl -i https://<CloudFrontURL>/api/health     # 502
   curl -i http://<PubAlbDns>/api/health          # 502 (같음 - CloudFront 무죄)
   # frontend EC2에 SSM 접속 후:
   curl -i http://<PriAlbDns>/api/health          # 502 (같음 - 앞 구간 전부 무죄)
   ```
2. Target Groups → `*-api-tg` → Targets: 상태 unhealthy, 이유는? (`Connection refused`)
3. api EC2에 SSM 접속해서 **서버 입장**에서 확인:
   ```bash
   curl -i localhost:3000/api/health   # connection refused - 3000엔 아무도 없다!
   sudo ss -lntp                       # 그럼 node는 어디서 듣고 있나?
   ```
4. node 프로세스가 **어느 포트**에 리스닝 중인가요? Target Group이 기대하는 포트는?
5. 왜 그 포트일까? 앱이 포트를 어디서 받는지 추적:
   ```bash
   sudo systemctl cat lab-api          # 서비스 정의를 읽어보세요. Environment= 줄에 주목
   ```

## 수리 원칙

> 인프라(TG)가 아니라 **앱 설정을 고치세요** : systemd 유닛의 PORT 값 수정 후 재시작:
> ```bash
> sudo sed -i 's/PORT=3001/PORT=3000/' /etc/systemd/system/lab-api.service
> sudo systemctl daemon-reload && sudo systemctl restart lab-api
> ```

## 고쳤다면 : 확인

- `curl localhost:3000/api/health` → `{"status":"ok","db":"connected"}`
- 1~2분 내 Target Group이 **healthy**로, 브라우저 화면이 초록으로 살아난다
- 메시지 보드에 글을 남겨보세요 : 등록되면 **CloudFront부터 RDS까지 전 구간 개통**

## 모니터링 데이터에서 흔적 찾기

- **ALB 액세스 로그** (S3 → Outputs의 `AlbLogsBucket` → `alb-pri/` 경로):
  로그 한 줄에서 `elb_status_code` 와 `target_status_code` 를 비교해보세요.
  502일 때 target 쪽은 뭐라고 찍혀 있나요? : "ALB 탓이냐 타깃 탓이냐"를 가르는 필드입니다
- **앱 로그** (CloudWatch Logs → `/lab/<스택명>/api`): 재시작 후 `server_started` 이벤트에
  `"port":3000` 이 찍힌 것을 확인 : 로그로 배포 결과를 검증하는 습관

막히면: [해답](solutions/solution-3.md)
