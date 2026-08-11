# 워크시트 4 — 탐정: 전부 정상인데 느리다

## 증상

모든 것이 초록불입니다. Target healthy, 화면 정상, 메시지 보드 동작.
그런데 화면을 계속 보고 있으면…

- 응답시간 배지가 평소 수십 ms → **가끔 3000ms 이상으로 튄다**
- TRAFFIC LOG에 **가끔 500**이 찍힌다
- 새로고침하면 또 멀쩡하다. **재현이 안 된다.**

## 지금까지의 도구로 다 해보세요

```bash
ping <...>        # 정상
telnet/타깃 상태   # 정상 (healthy)
curl -i .../api/messages   # 대부분 200... 어쩌다 한 번 500, 어쩌다 한 번 3초
```

**슈팅 체크리스트가 전부 통과합니다.** 고장이 아니라 *열화*입니다. 이제 데이터로 잡아야 합니다.

## 진단 순서 — 메트릭으로 발견하고, 로그로 추적한다

1. **CloudWatch 메트릭**: 콘솔 → CloudWatch → Metrics → ApplicationELB →
   pri-ALB의 `TargetResponseTime` 선택 → Statistic을 **Average 대신 p99**로 바꿔보세요.
   - Average는 평온한데 p99가 3초에 걸려 있다면 — 평균이 숨긴 소수의 피해자가 있다는 뜻
   - `HTTPCode_Target_5XX_Count` 도 겹쳐 보세요
2. **ALB 액세스 로그**로 피해자 색출 (S3 `alb-pri/` — Athena 없이 파일을 직접 열어도 됩니다):
   - `target_processing_time` 이 3초대인 줄, `target_status_code`가 500인 줄을 찾으세요
   - 느린 요청들에 공통점이 있나요? (경로? 시간대? 무작위?)
3. **앱 로그** (CloudWatch Logs Insights, 로그 그룹 `/lab/<스택명>/api`):
   ```
   fields @timestamp, @message
   | filter @message like /request/
   | parse @message '"ms":*,' as ms
   | sort @timestamp desc | limit 50
   ```
   느린 요청의 로그에서 `"chaos"` 필드를 발견했나요?

## 마지막 질문

메트릭과 로그로 여기까지 알아냈습니다:
**무엇이** (일부 요청), **얼마나** (3초 / 500), **어디서** (node.js 타깃).

그럼 — **앱 안의 어디서, 왜?** 어떤 함수가, 어떤 쿼리가, 어떤 코드 경로가?

지금 가진 도구로 이 질문에 답할 수 있나요?

> 답할 수 없는 게 정상입니다. 메트릭과 로그는 "무엇"까지 데려다주지만
> "왜"는 요청 하나가 앱 내부를 통과한 **전 과정**을 봐야 합니다.
> 그 도구의 이야기는 다음 시간에 — 이 범인을 잡으러 갑니다.

(범인의 정체가 궁금하면: [해답](solutions/solution-4.md) — 스포일러 주의)
