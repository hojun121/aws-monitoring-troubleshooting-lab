# 00. 사전 준비

## 필요한 것

| 항목 | 왜 필요한가 |
|---|---|
| AWS 계정 (관리자급 권한) | 스택 배포와 콘솔 진단 |
| 서울 리전 (`ap-northeast-2`) | 템플릿 기본값 기준 |
| AWS CLI v2 + Session Manager Plugin | **실습 중 EC2 접속용** (배포에는 불필요) |

> **배포 자체는 브라우저만 있으면 됩니다.** CLI는 시나리오 진단 때 EC2에 들어가기 위해 필요합니다.
> 스택 배포를 걸어두고 기다리는 ~20분 동안 아래를 설치하면 시간이 딱 맞습니다.

## AWS CLI v2 설치

- Windows: https://awscli.amazonaws.com/AWSCLIV2.msi 내려받아 실행
- macOS: `brew install awscli` 또는 https://awscli.amazonaws.com/AWSCLIV2.pkg

설치 후 자격증명 설정:

```bash
aws configure
# Access Key / Secret Key / region: ap-northeast-2 / output: json
```

확인:

```bash
aws sts get-caller-identity
```

## Session Manager Plugin 설치

SSM으로 셸 접속 & 포트포워딩을 하려면 CLI와 **별도로** 이 플러그인이 필요합니다.

- **Windows**: https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe
- **macOS**: `brew install --cask session-manager-plugin`

확인:

```bash
session-manager-plugin
# "The Session Manager plugin was installed successfully." 가 나오면 OK
```

## 준비 완료 체크리스트

- [ ] `aws sts get-caller-identity` 가 내 계정을 출력한다
- [ ] `session-manager-plugin` 이 설치 확인 메시지를 출력한다
- [ ] CloudFormation 스택이 `CREATE_COMPLETE` 상태다

다음: [01. 배포 (콘솔)](01-deploy-console.md)
