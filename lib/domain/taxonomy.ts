export const FAMILIES = ["NO96", "MK3", "FLEX", "SLIM", "GST", "ETC", "UNCLASSIFIED"] as const;
export const LAYERS = ["L1", "L2", "L3", "L4", "UNCLASSIFIED"] as const;
export const RISKS = ["HIGH", "MID", "LOW"] as const;
export const STATUS_GROUPS = ["valid", "pending", "inactive"] as const;
export const VERIFIED = ["API", "WEB", "UNVERIFIED"] as const;

export type Family = (typeof FAMILIES)[number];
export type Layer = (typeof LAYERS)[number];
export type Risk = (typeof RISKS)[number];
export type StatusGroup = (typeof STATUS_GROUPS)[number];
export type Verified = (typeof VERIFIED)[number];

export const FAMILY_LABEL: Record<Family, string> = {
  NO96: "NO96 계열",
  MK3: "Mark III 계열",
  FLEX: "Mark III Flex 계열",
  SLIM: "Slim/경량 계열",
  GST: "GST(Gaztransport) 계열",
  ETC: "기타",
  UNCLASSIFIED: "분류 필요",
};

export const FAMILY_SHORT: Record<Family, string> = {
  NO96: "NO96",
  MK3: "MK3",
  FLEX: "Flex",
  SLIM: "Slim",
  GST: "GST",
  ETC: "기타",
  UNCLASSIFIED: "분류 필요",
};

export const FAMILY_DESC: Record<Family, string> = {
  NO96: "인바(Invar) 박스형 단열 시스템 (NO96)",
  MK3: "스테인리스 주름 멤브레인 + 폴리우레탄 폼 패널 (Mark III)",
  FLEX: "Mark III 변형 · 유리섬유 보강 단열 패널 (Flex)",
  SLIM: "단열 두께를 줄인 경량 화물창 계열",
  GST: "GTT 계열 (NO96/Mark III 공통 요소 포함)",
  ETC: "위 계열로 분류되지 않는 단열·밀봉 기술",
  UNCLASSIFIED: "AI 신뢰도 부족 또는 미분류 — 수동 확인 필요",
};

export const LAYER_LABEL: Record<Layer, string> = {
  L1: "L1 · 전체 구조",
  L2: "L2 · 핵심 구조(코너·주름·앵커)",
  L3: "L3 · 부재·충전재·공정",
  L4: "L4 · 주변 요소",
  UNCLASSIFIED: "분류 필요",
};

export const LAYER_DESC: Record<Layer, string> = {
  L1: "화물창 전체 단열·밀봉 구조",
  L2: "코너, 주름, 앵커 등 핵심 구조 부재",
  L3: "패널·충전판·브리징 등 개별 부재와 시공",
  L4: "센서, 배관, 보조 설비 등 주변 요소",
  UNCLASSIFIED: "층위 미확정",
};

export const RISK_LABEL: Record<Risk, string> = { HIGH: "상", MID: "중", LOW: "하" };
export const STATUS_GROUP_LABEL: Record<StatusGroup, string> = {
  valid: "유효 권리",
  pending: "잠재 권리",
  inactive: "비유효",
};
export const VERIFIED_LABEL: Record<Verified, string> = {
  API: "API 확인",
  WEB: "웹 확인",
  UNVERIFIED: "미검증",
};

export const DISCLAIMER =
  "본 자료는 공개 특허 정보 기반 1차 기술 검토 자료이며, 침해·회피 판단은 변리사 검토 대상입니다.";

export const CONFIDENTIAL_NOTICE =
  "자사 설계 자료는 회사 승인 환경에서만 다룰 것. 이 앱은 공개 특허 정보만 처리합니다.";

export const FORBIDDEN_TERMS = ["침해한다", "침해하지 않는다", "무효"] as const;

export function findForbiddenTerms(text: string): string[] {
  return FORBIDDEN_TERMS.filter((t) => text.includes(t));
}
