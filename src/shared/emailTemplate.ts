// 메일 전문 템플릿 + 맞춤 제안 문단 삽입. 순수 함수 — 메인(내보내기)·렌더러(미리보기) 공용.

/** 제안 문단이 반드시 이 문장으로 끝나야 한다. `[기업명]`은 실제 기업명으로 치환. */
export function closingSentence(companyName: string): string {
  return `${companyName}의 행보에 깊은 존경을 표하며, 아동 복지를 위한 협력을 정중히 제안드립니다.`
}

/** 제안 문단이 규정된 마무리 문장으로 끝나는지 검증. */
export function hasValidClosing(paragraph: string, companyName: string): boolean {
  return paragraph.trim().endsWith(closingSentence(companyName))
}

/**
 * 담당자가 보낼 메일 전문을 조립한다.
 * `[기업 맞춤 문단]` 자리에 생성된 제안 문단(customParagraph)이 그대로 삽입된다.
 */
export function buildEmail(companyName: string, customParagraph: string): string {
  const paragraph = (customParagraph || '').trim() || warmFallbackParagraph(companyName)
  return `안녕하세요. 초록우산 사회공헌협력본부 김규민입니다.

사회공헌 활동 제안과 함께 첫 인사를 드립니다. 초록우산은 78년간 취약계층 아동을 지원해 온 국내 최대 아동복지 전문 기관으로, 기업의 니즈에 맞춰 현금·현물 등 다양한 형태의 사회공헌 파트너십을 진행하고 있습니다.

${paragraph}

아래 세 가지 제안서를 함께 보내드리니 확인 부탁드립니다.

■ 1. 초록우산 사회공헌 사업 제안서 - 초록우산 6대 중점사업 소개
초록우산은 아동의 전 생애(영아·돌봄·역량·자립·융화·환경)를 함께하는 맞춤형 사회공헌 사업을 운영하고 있습니다.

■ 2. 2026 물품후원 표준 제안서 - 기업 자원을 아동의 일상으로
초록우산은 긴밀한 물류 네트워크와 전국 아동복지 기반을 통해 기업의 자원이 취약계층 아동에게 직접 전달되도록 배분 구조를 설계합니다.

■ 3. 에너지취약계층 여름나기 사회공헌활동 제안서 - 폭염 대비 에너지취약계층 아동 여름나기 지원 캠페인
다가오는 폭염의 계절, 냉방 비용으로 생활비를 절감해야 하는 저소득층 아동·가정의 건강한 여름을 지원하는 특별 캠페인입니다.

상세 내용은 첨부된 3종의 제안서를 참고하여 주시고, 추가 문의사항이 있으시거나 협력 논의를 원하신다면 아래 연락처로 편하게 회신 주시면 감사하겠습니다.

■ 담당자 안내
초록우산어린이재단 사회공헌협력본부 나눔사업5팀 김규민 팀원
☎ 02-398-0253  ✉ 225082@chorogusan.or.kr

바쁘신 와중에도 검토와 함께, 취약계층 아동들의 건강과 행복을 위해 함께해 주시기를 정중히 부탁드립니다.

감사합니다.
초록우산 김규민 드림`
}

/** 제안 문단이 비었을 때 쓰는 무난하고 따뜻한 기본 문단. */
export function warmFallbackParagraph(companyName: string): string {
  return `귀사가 각자의 자리에서 건강한 가치를 지켜 오신 여정에 깊은 관심을 갖게 되었습니다. 그 진심이 우리 사회의 가장 여린 곳, 아이들의 오늘에도 따뜻하게 이어지기를 바랍니다. ${closingSentence(companyName)}`
}
