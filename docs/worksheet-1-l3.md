# 워크시트 1 : L3: 응답 없는 서버

## 증상

- 스택 Outputs의 `LabInstancePublicIp` 로 ping을 치면 **무응답**
- EC2 콘솔에선 인스턴스가 멀쩡히 `running`
- Systems Manager → Fleet Manager 에서 이 인스턴스만 **"Not connected"**

```bash
ping <LabInstancePublicIp>        # 100% loss
```

## 진단 순서 (낮은 계층부터)

1. **ping** : IP까지 도달하는가? → 실패. L3부터 막혔다는 신호
2. **traceroute** (Windows: `tracert`) : 어디까지 가는가?
   ```bash
   traceroute <LabInstancePublicIp>
   ```
3. 인스턴스는 running인데 패킷이 못 들어간다 → **경로 문제**. 콘솔에서 확인:
   - EC2 → 해당 인스턴스 → Networking 탭 → **Subnet ID** 클릭
   - 그 서브넷의 **Route table** 탭 → 라우팅 규칙을 읽어보세요
   - 다른 정상 서브넷(`pub-elb-a`)의 라우팅 테이블과 **비교**해보세요
4. 무엇이 다른가요? 인터넷으로 나가는 길(`0.0.0.0/0`)이 이 서브넷에는 있나요?

## 수리 원칙

> **새 리소스를 만들지 말고, 기존 것을 수정하세요.** (라우팅 테이블에 규칙 추가)

## 고쳤다면 : 확인

- `ping` 이 응답하기 시작한다
- 1~2분 내 Fleet Manager 에서 **Connected** 로 바뀐다 (SSM 에이전트가 스스로 재접속)
- 2~3분 내 `http://<LabInstancePublicIp>/` 를 열면 **"L3 FIXED"** 페이지가 뜬다 : 인터넷이 뚫리는 순간 서버가 스스로 웹서버를 설치하도록 되어 있습니다

## 모니터링 데이터에서 흔적 찾기

- **VPC Flow Logs** (Outputs의 `FlowLogGroupName`): CloudWatch Logs → 해당 로그 그룹에서
  ping 시도 시각대의 레코드를 찾아보세요. 패킷은 도달했는데 나가는 길이 없었다면 어떻게 기록될까요?
- **CloudTrail** (콘솔 → CloudTrail → Event history): 방금 내가 한 수리가
  어떤 API 이름으로 기록됐는지 찾아보세요 (힌트: `CreateRoute`)

막히면: [해답](solutions/solution-1.md)
