# 01. 배포 : CloudFormation 콘솔

**필요한 조작은 클릭 몇 번이 전부입니다.** 네트워크 & 서버 & DB & CDN & 모니터링 전부가
템플릿 하나로 자동 구축됩니다. (약 20분 소요 : CloudFront와 RDS가 느립니다)

## 방법 A : Launch Stack 버튼 (권장)

1. README의 **Launch Stack** 버튼 클릭 → CloudFormation "Quick create stack" 화면이 열림
2. Stack name: `monitoring-lab` (기본값 그대로)
3. 파라미터 전부 기본값 그대로 두기
4. 하단 체크박스 **"I acknowledge that AWS CloudFormation might create IAM resources"** 체크
5. **Create stack** 클릭

## 방법 B : 템플릿 직접 업로드 (버튼이 안 될 때)

1. 이 레포의 `infra/lab-stack.yaml` 을 내려받기 (GitHub에서 Raw → 저장)
2. AWS 콘솔 → CloudFormation → **Create stack → With new resources**
3. **Upload a template file** → 내려받은 파일 선택 → Next
4. Stack name: `monitoring-lab` → 파라미터 기본값 그대로 → Next → Next
5. IAM 체크박스 체크 → **Submit**

## 배포 중 (약 20분)

- Events 탭에서 리소스가 순서대로 생성되는 걸 볼 수 있습니다 (VPC → RDS → EC2 → ALB → CloudFront)
- **이 시간에 [00. 사전 준비](00-prerequisites.md)의 CLI & 플러그인을 설치하세요**
- RDS(~10분)와 CloudFront(~5분)가 가장 오래 걸립니다

## 배포 완료 확인

스택 상태가 `CREATE_COMPLETE` 가 되면 **Outputs 탭**을 여세요. 여기가 실습 안내판입니다:

| Output | 용도 |
|---|---|
| `CloudFrontURL` | 서비스 주소 : 브라우저에서 열기 |
| `LabInstancePublicIp` | 시나리오 1의 ping 대상 |
| `LabInstanceId` / `FrontendInstanceId` / `ApiInstanceId` | SSM 접속용 인스턴스 ID |
| `PriAlbDns` / `RdsEndpoint` | 포트포워딩 대상 |
| `FlowLogGroupName` / `AlbLogsBucket` | 모니터링 데이터 위치 |

**CloudFrontURL을 열었을 때 화면은 뜨는데 데이터가 안 나오면 : 정상입니다.**
그게 실습의 출발선입니다. [워크시트 1번](worksheet-1-l3.md)부터 시작하세요.

## 정리 (실습 종료 후 반드시!)

CloudFormation 콘솔 → 스택 선택 → **Delete** → 확인. 끝.
S3 버킷 자동 비우기가 내장되어 있어 잔여물 없이 전부 삭제됩니다 (~15분 소요).
CloudFront & NAT 삭제가 느린 것이지 멈춘 게 아닙니다 : 기다리세요.
