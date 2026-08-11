# 해답 1 : L3 ⚠️ 스포일러

## 원인

pub-lab 서브넷의 라우팅 테이블(`<스택명>-rt-lab`)에 **`0.0.0.0/0 → IGW` 경로가 없다.**
로컬(VPC 내부) 경로만 있어서, 인터넷에서 온 패킷에 대한 응답이 나갈 길이 없다.

## 수리

VPC 콘솔 → Route tables → `<스택명>-rt-lab` → Routes → **Edit routes → Add route**
- Destination: `0.0.0.0/0`
- Target: Internet Gateway → `<스택명>-igw`
- Save

## 확인

- `ping <LabInstancePublicIp>` 응답 시작
- 1~2분 후 SSM Fleet Manager에서 Connected
- 2~3분 후 `http://<LabInstancePublicIp>/` → "L3 FIXED" 페이지

## 교훈

- 인스턴스가 `running`인 것과 네트워크로 도달 가능한 것은 완전히 다른 문제
- 퍼블릭 IP가 있어도 **라우팅 테이블에 IGW 경로가 없으면 그 서브넷은 프라이빗**
- SSM & yum 같은 관리 통로도 같은 네트워크를 쓴다 : L3가 죽으면 다 같이 죽는다
