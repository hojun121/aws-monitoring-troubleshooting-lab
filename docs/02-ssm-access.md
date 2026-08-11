# 02. SSM Session Manager : 프라이빗 EC2 접속

이 랩의 EC2는 전부 프라이빗(또는 SSH 미개방)이고 **SSH 키가 아예 없습니다.**
접속은 전부 SSM Session Manager로 합니다 : 인바운드 포트 0개, 에이전트가
아웃바운드 443으로 나가는 구조라 방화벽에 구멍을 낼 필요가 없습니다.

인스턴스 ID는 스택 **Outputs 탭**에서 복사하세요.

## 1. 셸 접속

### 콘솔에서
EC2 콘솔 → 인스턴스 선택 → **Connect → Session Manager → Connect**

### 로컬 터미널에서
```bash
aws ssm start-session --target i-xxxxxxxxxxxxxxxxx
```

접속 후 자주 쓰는 진단 명령:

```bash
sudo ss -lntp                 # 지금 어떤 포트에 뭐가 리스닝 중인가
curl -v localhost:3000/       # 로컬에서 앱이 응답하는가
sudo systemctl status lab-api # 서비스 상태
sudo tail -f /var/log/lab-api.log   # 앱 로그 실시간
```

## 2. 포트 포워딩 ① : 로컬 브라우저로 내부 ALB 호출

pri-ALB는 인터넷에서 접근 불가입니다. SSM 터널로 로컬 8080에 연결하면
**내 브라우저/터미널에서 내부 ALB를 직접 테스트**할 수 있습니다.

```bash
aws ssm start-session \
  --target <FrontendInstanceId> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters host="<PriAlbDns>",portNumber="80",localPortNumber="8080"
```

다른 터미널에서:

```bash
curl -i http://localhost:8080/api/health
```

## 3. 포트 포워딩 ② : 로컬 MySQL 클라이언트로 RDS 접속

Bastion 없이 프라이빗 RDS에 붙는 실무 표준 패턴입니다.

```bash
aws ssm start-session \
  --target <ApiInstanceId> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters host="<RdsEndpoint>",portNumber="3306",localPortNumber="13306"
```

다른 터미널(또는 MySQL Workbench, host=127.0.0.1 port=13306):

```bash
mysql -h 127.0.0.1 -P 13306 -u labadmin -p labdb
# 비밀번호: 스택 파라미터 DbPassword (기본값 LabPassw0rd!)
mysql> SELECT * FROM messages;
```

## 접속이 안 될 때

| 증상 | 원인 후보 |
|---|---|
| 인스턴스가 SSM 목록에 없음 / "Not connected" | 에이전트가 아웃바운드 443으로 못 나가는 상태 : **그 인스턴스의 네트워크 경로를 의심하세요** (힌트: 시나리오 1) |
| `SessionManagerPlugin is not found` | Session Manager Plugin 미설치 → [00. 사전 준비](00-prerequisites.md) |
| `An error occurred (TargetNotConnected)` | 인스턴스 부팅 직후라면 2~3분 대기 후 재시도 |

> SSM도 결국 네트워크 위에 있습니다. L3가 죽으면 관리 통로도 함께 죽습니다 : > 그리고 그걸 고치면 에이전트가 스스로 재접속합니다.
