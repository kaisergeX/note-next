import 'server-only'

import {z} from 'zod'
import {completeJson, type LMStudioMessage} from '~/lib/ai/lm-studio'
import {
  draftPersonaInputSchema,
  type DraftPersonaInput,
} from '~/lib/ai/persona-validation'

export const personaDraftOutputSchema = z.object({
  name: z.string().min(1).optional(),
  age: z.number().int().min(1).max(120).optional(),
  gender: z.string().min(1).max(50).optional(),
  region: z.string().min(1).max(50).optional(),
  incomeBracket: z.string().min(1).max(100).optional(),
  occupation: z.string().min(1).max(100).optional(),
  backgroundTags: z.array(z.string().min(1).max(100)).max(20).optional(),
  personalitySliders: z
    .object({
      calm_anxious: z.number().int().min(0).max(100),
      optimistic_cynical: z.number().int().min(0).max(100),
      frugal_spendthrift: z.number().int().min(0).max(100),
    })
    .optional(),
  interviewStance: z.string().min(1).max(200).optional(),
  quirksFreetext: z.string().min(1).max(2000).optional(),
  bio: z.string().min(1),
  systemPrompt: z.string().min(1),
})
export type PersonaDraft = z.infer<typeof personaDraftOutputSchema>

/**
 * Phase 6 diversity-guard hook: summary of active roster (names +
 * region/occupation/tags/slider-combo). Optional in Phase 3.
 */
export type RosterSummaryEntry = {
  name: string
  region: string
  occupation: string | null
  backgroundTags: string[]
  topSliders: string
}

/**
 * Drafting rules for the single-draft path; the system template wraps this
 * core with its own intro paragraph.
 */
const DRAFTING_RULES_CORE = `MỌI trường đầu vào bị bỏ trống hoặc thiếu có nghĩa là bạn PHẢI tự sáng tác một giá trị hợp lý, nhất quán với vùng miền/locale và các trường còn lại, rồi trả giá trị đó về đúng trường tương ứng trong JSON đầu ra ("name", "age", "gender", "region", "incomeBracket", "occupation", "backgroundTags", "personalitySliders", "interviewStance", "quirksFreetext"). Các thanh trượt tính cách (personalitySliders) luôn được cung cấp dưới dạng số nguyên 0–100.

Nếu dữ liệu nhận được kèm theo khối "Mô tả gốc từ nhà nghiên cứu" thì khối đó là DUY NHẤT KHÔNG THAY ĐỔI (AUTHORITATIVE): mọi trường mà mô tả gốc nêu rõ (tuổi, giới tính, vùng miền/tỉnh thành, nghề nghiệp, thu nhập, hoàn cảnh nền tảng, tính cách, quirk, thái độ phỏng vấn) PHẢI lấy nguyên từ mô tả gốc; chỉ tự sáng tác giá trị cho những trường mà mô tả gốc KHÔNG nhắc đến, và các giá trị tự sáng tác phải nhất quán với mô tả gốc. Khi mô tả gốc mâu thuẫn với bất kỳ trường JSON nào được cung cấp, mô tả gốc luôn thắng.

Vùng miền ("region") là văn bản tự do: nó đến từ nhà nghiên cứu hoặc do bạn tự sáng tạo. Nếu region hợp lý với quốc gia/locale của nhân vật, hãy dùng nguyên nó trong bio, diễn đạt bằng tiếng Việt tự nhiên theo đúng phương ngữ tương ứng. Nếu region không hợp lý hoặc bị bỏ trống, hãy lặng lẽ tự sáng tạo một vùng miền phù hợp với quốc gia đó và dùng nó. KHÔNG BAO GIỜ nhắc lại bất kỳ lỗi xác thực (validation) nào trong đầu ra.

Đối tượng JSON đầu ra gồm đúng các khóa sau: "name" (chuỗi), "age" (số nguyên 1–120), "gender" (chuỗi), "region" (chuỗi), "incomeBracket" (chuỗi), "occupation" (chuỗi), "backgroundTags" (mảng chuỗi), "personalitySliders" (đối tượng ba số nguyên 0–100: calm_anxious, optimistic_cynical, frugal_spendthrift), "interviewStance" (chuỗi), "quirksFreetext" (chuỗi), "bio" (chuỗi), "systemPrompt" (chuỗi). Trường có sẵn thì trả lại giá trị đã nhận sau khi áp dụng quy tắc khóa chuẩn bên dưới; trường bạn tự sáng tác thì điền giá trị mới.

Quy tắc khóa chuẩn cho các trường thuộc tính trong JSON đầu ra: "gender" trả về khóa tiếng Anh chuẩn "male" hoặc "female" khi có cách diễn đạt tự nhiên phù hợp (đầu vào bỏ trống nghĩa là không xác định — bạn có thể để nguyên không trả trường này hoặc tự sáng tạo; nếu tự sáng tạo thì vẫn phải trả về một trong hai khóa đó); "incomeBracket" trả về "low", "medium" hoặc "high" khi phù hợp; "interviewStance" trả về một trong các khóa "cooperative", "guarded", "talkative", "suspicious" khi thái độ khớp với một khóa, còn không thì trả về nguyên văn (verbatim) văn bản tự do đã nhận. Giá trị tự do của người dùng không khớp khóa nào thì được giữ nguyên verbatim. Trái lại, văn bản bio và systemPrompt LUÔN diễn đạt các thuộc tính này bằng tiếng Việt tự nhiên (ví dụ Nam, Nữ, thu nhập thấp/trung bình/cao, từ ngữ theo phương ngữ) — KHÔNG BAO GIỜ chèn khóa tiếng Anh thô vào bio hoặc systemPrompt.

"bio": hồ sơ mô tả bằng tiếng Việt, dài 2–3 đoạn văn, viết ngôi thứ ba, văn xuôi tự nhiên, KHÔNG dùng gạch đầu dòng. bio phải đan xen các yếu tố sau:
- Vùng miền: chọn từ vựng và ngữ điệu theo phương ngữ tương ứng với vùng miền của nhân vật.
- Tỉnh/thành phố và các background_tags: dùng làm màu sắc địa phương; các tag PHẢI thực sự xuất hiện trong hoặc chi phối nội dung, không chỉ được liệt kê cho có.
- Nghề nghiệp và khoảng thu nhập.
- Tính cách thể hiện qua vị trí các thanh trượt: hãy diễn giải ý nghĩa của vị trí đó (ví dụ calm_anxious 85 nghĩa là người hay lo âu; optimistic_cynical 20 nghĩa là bi quan), KHÔNG đọc lại con số.
- Thái độ khi tham gia phỏng vấn (interview_stance).
- Quirk: ký ức cụ thể / thói quen nói / điều dễ khó chịu PHẢI được đưa vào nguyên văn hoặc gần nguyên văn.
- Các giá trị bạn tự sáng tác phải được cài tự nhiên vào mạch văn của bio như thể chúng luôn là một phần của nhân vật, không ghi chú hay liệt kê riêng rằng chúng do bạn thêm vào.

"systemPrompt": prompt vai diễn bằng tiếng Việt, viết ở ngôi thứ hai ("Bạn là {tên}..."), sẽ được dùng để điều khiển một buổi phỏng vấn trực tiếp sau này. QUAN TRỌNG: các quy tắc nói chung (trả lời ngắn tự nhiên như người thật, không bài luận, được phép quên/hiểu sai/nêu ý kiến riêng, không chủ động cung cấp thông tin...) do hệ thống tự áp dụng khi chạy — KHÔNG được lặp lại chúng trong systemPrompt. systemPrompt PHẢI NGẮN GỌN (không quá 10–12 câu) và chỉ gồm những gì ĐỘC QUYỀN của nhân vật này:
- Danh tính và tinh thần của bio, viết theo khẩu ngữ của vùng miền.
- Giọng nói riêng: từ đệm, thán từ, cách nói đặc trưng của nhân vật; chủ đề nhân vật hay lan sang khi nói.
- Cách xưng hô của nhân vật khi gặp người lạ: tự xưng là gì, gọi người đối diện là gì tùy theo tuổi/giới tính/vai vế của nhân vật (ví dụ người trên 50 tự xưng "chú" hoặc "cô" với người trẻ), cùng thái độ theo bậc — kính nhường với người lớn tuổi, suồng sã thân mật với người ngang tuổi.
- Hành vi theo interview_stance. Diễn giải interview_stance tự do; các khóa chuẩn mang hành vi tương ứng như sau: cooperative → dễ chịu, sẵn sàng trả lời khi được hỏi, cởi mở chia sẻ; guarded → thận trọng, hé mở chậm rãi, câu ngắn, né chi tiết nhạy cảm; talkative → nói dài, hay lan man, kể lể theo mạch riêng của nhân vật; suspicious → hoài nghi, né tránh, câu cụt, thậm chí hỏi lại mục đích của người phỏng vấn. Giá trị văn bản tự do khác thì diễn giải theo nghĩa trạng ngữ.
- Nếu frugal_spendthrift nghiêng về phía spendthrift thì hay né tránh, vuốt ve chuyện tiền bạc; nếu nghiêng về phía frugal thì tỏ ra lo lắng, tính toán kỹ về tiền bạc.
- Yêu cầu luôn giữ vai, không bao giờ tiết lộ mình là AI.

Chỉ trả về JSON hợp lệ, không thêm lời giải thích hay văn bản nào khác.`

const SYSTEM_PROMPT_TEMPLATE = `Bạn là trợ lý của nhà nghiên cứu, phụ trách soạn thảo tài liệu cho nhân vật mô phỏng dùng trong các buổi phỏng vấn nghiên cứu thị trường tại Việt Nam. Bạn nhận được thông tin nhân vật dưới dạng JSON và phải trả về MỘT đối tượng JSON duy nhất.

${DRAFTING_RULES_CORE}`

const ROSTER_HEADER = `Ngoài ra, tránh trùng lặp với các nhân vật hiện có. Dưới đây là danh sách các nhân vật đang hoạt động, kèm vùng miền, nghề nghiệp, background_tags và các trục tính cách nổi bật của từng người. Hãy bảo đảm nhân vật mới khác biệt rõ rệt so với tất cả các nhân vật này:`

function withSeedDescription(
  systemMessage: string,
  seedDescription?: string,
): string {
  if (!seedDescription) return systemMessage
  return `${systemMessage}\n\nMô tả gốc từ nhà nghiên cứu:\n"""\n${seedDescription}\n"""`
}

function formatRosterEntries(rosterSummary: RosterSummaryEntry[]): string {
  return rosterSummary
    .map(
      (entry) =>
        `- ${entry.name} — ${entry.region} / ${entry.occupation ?? 'unknown'} / ${entry.backgroundTags.join(', ')} — ${entry.topSliders}`,
    )
    .join('\n')
}

function withRosterSummary(
  systemMessage: string,
  rosterSummary: RosterSummaryEntry[],
): string {
  if (rosterSummary.length === 0) return systemMessage
  return `${systemMessage}\n\n${ROSTER_HEADER}\n${formatRosterEntries(rosterSummary)}`
}

export function buildPersonaDraftMessages(
  persona: DraftPersonaInput,
  rosterSummary?: RosterSummaryEntry[],
): LMStudioMessage[] {
  const systemMessage = withSeedDescription(
    withRosterSummary(SYSTEM_PROMPT_TEMPLATE, rosterSummary ?? []),
    persona.seedDescription,
  )

  // Chỉ gửi các trường có giá trị — trường bị bỏ trống/như undefined nghĩa là
  // mô hình tự sáng tác; không gửi "gender": "" dạng rỗng. seedDescription
  // không nằm trong payload JSON: nó đi qua khối "Mô tả gốc" ở system message.
  const payload: Record<string, unknown> = {}
  if (persona.name) payload.name = persona.name
  if (persona.gender) payload.gender = persona.gender
  if (persona.age !== undefined) payload.age = persona.age
  payload.locale = persona.locale
  if (persona.region) payload.region = persona.region
  if (persona.incomeBracket) payload.incomeBracket = persona.incomeBracket
  if (persona.occupation) payload.occupation = persona.occupation
  if (persona.backgroundTags && persona.backgroundTags.length > 0) {
    payload.backgroundTags = persona.backgroundTags
  }
  payload.personalitySliders = persona.personalitySliders
  if (persona.interviewStance) payload.interviewStance = persona.interviewStance
  if (persona.quirksFreetext) payload.quirksFreetext = persona.quirksFreetext

  return [
    {role: 'system', content: systemMessage},
    {role: 'user', content: JSON.stringify(payload)},
  ]
}

export async function draftPersona(
  persona: DraftPersonaInput,
  rosterSummary?: RosterSummaryEntry[],
  opts?: {timeoutMs?: number; signal?: AbortSignal},
): Promise<PersonaDraft> {
  // Actions pre-validate; this re-parse is defense in depth.
  draftPersonaInputSchema.parse(persona)
  return await completeJson(
    buildPersonaDraftMessages(persona, rosterSummary),
    personaDraftOutputSchema,
    opts,
  )
}
