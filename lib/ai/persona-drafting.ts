import 'server-only'

import {z} from 'zod'
import {completeJson, type LMStudioMessage} from '~/lib/ai/lm-studio'
import {
  personaInputSchema,
  type PersonaInput,
} from '~/lib/ai/persona-validation'

export const personaDraftSchema = z.object({
  bio: z.string().min(1),
  systemPrompt: z.string().min(1),
})
export type PersonaDraft = z.infer<typeof personaDraftSchema>

/**
 * Phase 6 diversity-guard hook: summary of active roster (names +
 * region/occupation/tags/slider-combo). Optional in Phase 3.
 */
export type RosterSummaryEntry = {
  name: string
  region: string
  occupation: string
  backgroundTags: string[]
  topSliders: string
}

const SYSTEM_PROMPT_TEMPLATE = `Bạn là trợ lý của nhà nghiên cứu, phụ trách soạn thảo tài liệu cho nhân vật mô phỏng dùng trong các buổi phỏng vấn nghiên cứu thị trường tại Việt Nam. Bạn nhận được thông tin nhân vật dưới dạng JSON và phải trả về MỘT đối tượng JSON duy nhất gồm đúng hai khóa "bio" và "systemPrompt".

"bio": hồ sơ mô tả bằng tiếng Việt, dài 2–3 đoạn văn, viết ngôi thứ ba, văn xuôi tự nhiên, KHÔNG dùng gạch đầu dòng. bio phải đan xen các yếu tố sau:
- Vùng miền (Bắc/Trung/Nam): chọn từ vựng và ngữ điệu theo phương ngữ tương ứng.
- Tỉnh/thành phố và các background_tags: dùng làm màu sắc địa phương; các tag PHẢI thực sự xuất hiện trong hoặc chi phối nội dung, không chỉ được liệt kê cho có.
- Nghề nghiệp và khoảng thu nhập.
- Tính cách thể hiện qua vị trí các thanh trượt: hãy diễn giải ý nghĩa của vị trí đó (ví dụ calm_anxious 85 nghĩa là người hay lo âu; optimistic_cynical 20 nghĩa là bi quan), KHÔNG đọc lại con số.
- Thái độ khi tham gia phỏng vấn (interview_stance).
- Quirk: ký ức cụ thể / thói quen nói / điều dễ khó chịu PHẢI được đưa vào nguyên văn hoặc gần nguyên văn.

"systemPrompt": prompt vai diễn bằng tiếng Việt, viết ở ngôi thứ hai ("Bạn là {tên}..."), sẽ được dùng để điều khiển một buổi phỏng vấn trực tiếp sau này. systemPrompt phải:
- Gói gọn danh tính và tinh thần của bio.
- Đưa ra chỉ dẫn hành vi rõ ràng suy ra từ interview_stance (ví dụ: guarded → ấp úng, trả lời ngắn, cần thời gian mới mở lòng; cooperative → cởi mở, sẵn sàng chia sẻ; talkative → hay lan man sang chuyện kể lể; suspicious → hoài nghi ý định của người phỏng vấn).
- Nếu frugal_spendthrift nghiêng về phía spendthrift thì hay né tránh, vuốt ve chuyện tiền bạc; nếu nghiêng về phía frugal thì tỏ ra lo lắng, tính toán kỹ về tiền bạc.
- Yêu cầu luôn trả lời bằng tiếng Việt, luôn giữ vai và không bao giờ tiết lộ mình là AI.

Chỉ trả về JSON hợp lệ, không thêm lời giải thích hay văn bản nào khác.`

const ROSTER_HEADER = `Ngoài ra, tránh trùng lặp với các nhân vật hiện có. Dưới đây là danh sách các nhân vật đang hoạt động, kèm vùng miền, nghề nghiệp, background_tags và các trục tính cách nổi bật của từng người. Hãy bảo đảm nhân vật mới khác biệt rõ rệt so với tất cả các nhân vật này:`

export function buildPersonaDraftMessages(
  persona: PersonaInput,
  rosterSummary?: RosterSummaryEntry[],
): LMStudioMessage[] {
  let systemMessage = SYSTEM_PROMPT_TEMPLATE
  if (rosterSummary && rosterSummary.length > 0) {
    const rosterLines = rosterSummary
      .map(
        (entry) =>
          `- ${entry.name} — ${entry.region} / ${entry.occupation} / ${entry.backgroundTags.join(', ')} — ${entry.topSliders}`,
      )
      .join('\n')
    systemMessage = `${systemMessage}\n\n${ROSTER_HEADER}\n${rosterLines}`
  }

  // Chỉ gửi các trường phục vụ sinh nội dung — không gửi status/bio/prompt.
  const payload = {
    name: persona.name,
    gender: persona.gender,
    age: persona.age,
    locale: persona.locale,
    region: persona.region,
    incomeBracket: persona.incomeBracket,
    occupation: persona.occupation,
    backgroundTags: persona.backgroundTags,
    personalitySliders: persona.personalitySliders,
    interviewStance: persona.interviewStance,
    quirksFreetext: persona.quirksFreetext,
  }

  return [
    {role: 'system', content: systemMessage},
    {role: 'user', content: JSON.stringify(payload)},
  ]
}

export async function draftPersona(
  persona: PersonaInput,
  rosterSummary?: RosterSummaryEntry[],
  opts?: {timeoutMs?: number; signal?: AbortSignal},
): Promise<PersonaDraft> {
  personaInputSchema.parse(persona)
  return await completeJson(
    buildPersonaDraftMessages(persona, rosterSummary),
    personaDraftSchema,
    opts,
  )
}
