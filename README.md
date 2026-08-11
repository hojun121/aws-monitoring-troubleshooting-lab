# AWS Monitoring & Troubleshooting Lab

**고장난 채로 배포되는 3-tier 서비스.** 여러분의 임무는 수동 진단 도구(ping & telnet & curl)와
모니터링 데이터(VPC Flow Logs & CloudWatch & ALB 액세스 로그 & CloudTrail)로 원인을 찾아 고치는 것입니다.

[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://ap-northeast-2.console.aws.amazon.com/cloudformation/home?region=ap-northeast-2#/stacks/quickcreate?templateURL=https%3A%2F%2Fhojun121-cfn-templates.s3.ap-northeast-2.amazonaws.com%2Faws-monitoring-troubleshooting-lab%2Flab-stack.yaml&stackName=monitoring-lab)

> 버튼이 안 되면: [`infra/lab-stack.yaml`](infra/lab-stack.yaml)을 내려받아
> CloudFormation 콘솔 → **Create stack → Upload a template file** 로 배포하세요.
> 자세한 절차: [docs/01-deploy-console.md](docs/01-deploy-console.md)

## 아키텍처

```
사용자
  │ https
  ▼
CloudFront ──── /assets/* ────▶  S3 (정적 에셋)
  │ 그 외 전부 (캐시 없음)
  ▼
pub-ALB ──▶ next.js EC2 (SSR, 프라이빗) ──▶ pri-ALB ──▶ node.js EC2 (프라이빗) ──▶ RDS MySQL
                                                                    │
pub-lab EC2 (퍼블릭, L3 진단 연습용)                        VPC Flow Logs & ALB 액세스 로그
                                                            CloudWatch Agent & CloudTrail 상시 기록
```

- VPC `172.16.0.0/23`, 서브넷 6종 × 2AZ (`pub-elb` `pub-nat` `pub-lab` `pri-elb` `pri-svc` `pri-db`)
- 실제 리소스는 AZ-a 단일 배치 (비용 절약 : 서브넷 이중화로 확장 여지는 유지)
- 모든 EC2는 SSM Session Manager로 접속 (SSH 키 없음) : [docs/02-ssm-access.md](docs/02-ssm-access.md)

## 배포되는 고장 4종

| # | 워크시트 | 증상 |
|---|---|---|
| 1 | [L3 : 응답 없는 서버](docs/worksheet-1-l3.md) | pub-lab EC2가 ping 무응답, SSM에도 안 잡힘 |
| 2 | [L4 : 화면은 뜨는데 API가 죽음](docs/worksheet-2-l4.md) | 페이지는 열리는데 데이터가 안 나옴 (timeout) |
| 3 | [L7 : 고쳤는데 또 죽음](docs/worksheet-3-l7.md) | 이번엔 502 (refused) : 아까와 뭐가 다른가? |
| 4 | [탐정 : 전부 정상인데 느리다](docs/worksheet-4-detective.md) | 가끔 3초 지연, 가끔 500. 모든 체크는 초록불 |

**순서대로 푸세요.** 2를 고쳐야 3이 드러나고, 3을 고쳐야 4가 관측됩니다.

## 시작하기

1. **사전 준비** (배포 전 5분): [docs/00-prerequisites.md](docs/00-prerequisites.md)
2. **배포** (~20분 소요): 위 Launch Stack 버튼 → 대기 중 Session Manager Plugin 설치
3. 스택 **Outputs 탭**이 실습 안내판입니다 : CloudFront URL부터 열어보세요
4. 워크시트 1번부터 진행

## 비용

시간당 약 **US$0.17 (약 230원)** : EC2 t3.micro ×3, ALB ×2, RDS db.t4g.micro, NAT GW ×1.
실습 종료 후 **CloudFormation 콘솔에서 Delete stack 클릭 한 번**으로 전부 정리됩니다
(S3 버킷 자동 비우기 내장, 잔여 리소스 없음).

## 레포 구조

```
infra/lab-stack.yaml   # 올인원 CloudFormation 템플릿 (학생이 배포하는 유일한 파일)
apps/frontend/         # Next.js SSR (EC2가 부팅 시 클론해서 실행)
apps/api/              # Express + MySQL API (고장 4의 카오스 내장)
docs/                  # 배포 가이드 & SSM 가이드 & 워크시트 & 해답
```

> ⚠️ 실습용 단순화: RDS 비밀번호가 템플릿 파라미터 기본값으로 들어있습니다.
> 실무에서는 Secrets Manager 동적 참조를 사용하세요.

---

### 멘토 노트 (템플릿 갱신 시)

Launch Stack 버튼은 S3 사본을 바라봅니다. `infra/lab-stack.yaml` 수정 후:

```bash
aws s3 cp infra/lab-stack.yaml \
  s3://hojun121-cfn-templates/aws-monitoring-troubleshooting-lab/lab-stack.yaml
```
