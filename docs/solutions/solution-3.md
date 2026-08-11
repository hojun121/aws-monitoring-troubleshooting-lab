# 해답 3 : L7 ⚠️ 스포일러

## 원인

node.js 앱이 **3001 포트**에 리스닝 중이다. Target Group은 **3000**으로 보낸다.
systemd 유닛(`/etc/systemd/system/lab-api.service`)의 `Environment=PORT=3001` 이 범인.
3000엔 아무 프로세스도 없으니 커널이 즉시 RST(connection refused) → pri-ALB가 **502**.

## 수리

api EC2에 SSM 접속 후:

```bash
sudo sed -i 's/PORT=3001/PORT=3000/' /etc/systemd/system/lab-api.service
sudo systemctl daemon-reload
sudo systemctl restart lab-api
curl -i localhost:3000/api/health     # {"status":"ok","db":"connected"}
```

## 확인

- 1~2분 내 Target Group healthy → 화면 초록불
- 메시지 보드 등록 성공 = CloudFront→S3/ALB→next.js→pri-ALB→node.js→RDS 전 구간 개통

## 교훈

- 인프라가 완벽해도 **앱 설정 한 줄**이 서비스를 죽인다 : L7 문제는 서버 안에서 잡는다
- 진단 3종 세트: `ss -lntp`(누가 어디서 듣나) & `curl localhost`(서버 입장에서 확인) & `systemctl cat`(설정의 출처 추적)
- ALB 액세스 로그의 `elb_status_code` vs `target_status_code` 가 책임 소재를 가른다
