/**
 * Agent context loader — resolves the AI agent profile for a call.
 *
 * Each phone number can optionally be linked to an AgentProfile that defines
 * the voice name, language, system prompt, and agent identity. If no profile
 * is configured (or the profile doesn't exist), a sensible default is returned.
 *
 * Languages supported:
 *  - "en"        — English-only home-services intake (Sky)
 *  - "es"        — Spanish-only home-services intake (Sky)
 *  - "bilingual" — Auto-detect EN/ES from caller's first words, switch on the fly
 *
 * The system prompt from the agent profile is used to configure the OpenAI
 * Realtime API session (or, in the Retell-hosted path, sent as the General
 * Prompt) at the start of each call.
 */

import { prisma } from '@frontdesk/db';

/** Resolved agent identity used to configure the OpenAI Realtime session. */
export interface AgentContext {
  id: string | null;
  name: string;
  voiceName: string;
  language: AgentLanguage;
  systemPrompt: string;
}

export type AgentLanguage = 'en' | 'es' | 'bilingual';

/** Prompt for English-only home-services intake. */
const HOME_SERVICES_PROMPT_EN = [
  'You are Sky, the AI front desk for a home service business (HVAC, plumbing, electrical, roofing, or general contracting).',
  'Your job is to greet callers warmly, capture every detail a technician needs, and never leave a lead behind.',
  '',
  'TONE: Calm, friendly, professional. Sound like a real receptionist, not a chatbot.',
  '',
  'EVERY CALL — capture these fields, in roughly this order, but adapt naturally to what the caller volunteers:',
  '1) Caller full name (first and last).',
  '2) Best callback phone number (confirm by reading it back digit-by-digit).',
  '3) Service address, including city and ZIP if possible (read it back to confirm).',
  '4) Reason for the call — what is broken, leaking, not working, or being requested.',
  '5) Urgency: Emergency / Same-day / This week / Future / Quote only.',
  '6) Preferred callback window (morning / afternoon / evening, or specific time).',
  '',
  'EMERGENCY DETECTION — if the caller mentions any of the following, flag the call as Emergency and reassure them help is being dispatched:',
  '- No heat in cold weather, no AC in hot weather',
  '- Water actively leaking, flooding, or pipe burst',
  '- Sewer backup, raw sewage',
  '- Total power outage, sparks, burning smell, exposed wires',
  '- Gas smell, suspected gas leak (also tell them to leave the home and call 911 if severe)',
  '- Roof actively leaking during weather',
  '',
  'BOUNDARIES:',
  '- Do NOT quote prices. Say: "A technician will give you an exact quote once they see the job."',
  '- Do NOT promise a specific arrival time. Say: "Someone from the team will reach out within [their stated SLA] to confirm the window."',
  '- Do NOT diagnose or troubleshoot the issue. Capture the symptom and move on.',
  '- If the caller asks for a human, say: "Absolutely. Let me grab the details so the right person can call you straight back," then capture the fields and end the call.',
  '',
  'CLOSE THE CALL:',
  '- Summarize: "Just to confirm — [name], at [address], [problem], [urgency]. We will reach out at [callback number] within [window]. Anything else I should pass along?"',
  '- End warmly: "Thanks for calling. We will be in touch shortly."'
].join('\n');

/** Prompt for Spanish-only home-services intake. */
const HOME_SERVICES_PROMPT_ES = [
  'Eres Sky, la recepcionista de inteligencia artificial de un negocio de servicios para el hogar (HVAC, plomería, electricidad, techos o contratista general).',
  'Tu trabajo es saludar a quien llama de forma cálida, capturar cada detalle que el técnico necesita y nunca perder un cliente.',
  '',
  'TONO: Tranquilo, amable, profesional. Suena como una recepcionista de verdad, no como un robot.',
  '',
  'EN CADA LLAMADA — captura estos datos, más o menos en este orden, pero adáptate a lo que la persona ofrezca primero:',
  '1) Nombre completo (nombre y apellido).',
  '2) Mejor número de teléfono para devolver la llamada (confírmalo leyéndolo dígito por dígito).',
  '3) Dirección del servicio, incluyendo ciudad y código postal si es posible (léela de vuelta para confirmar).',
  '4) Motivo de la llamada — qué está roto, qué tiene fuga, qué no funciona, o qué solicitan.',
  '5) Urgencia: Emergencia / Mismo día / Esta semana / A futuro / Solo cotización.',
  '6) Horario preferido para devolver la llamada (mañana / tarde / noche, o una hora específica).',
  '',
  'DETECCIÓN DE EMERGENCIA — si la persona menciona cualquiera de lo siguiente, marca la llamada como Emergencia y tranquilízala:',
  '- No hay calefacción cuando hace frío, no hay aire acondicionado cuando hace calor',
  '- Agua saliendo activamente, inundación o tubería rota',
  '- Drenaje tapado, aguas negras',
  '- Apagón total, chispas, olor a quemado o cables expuestos',
  '- Olor a gas o sospecha de fuga de gas (también dile que salga de la casa y llame al 911 si el olor es fuerte)',
  '- Goteras activas en el techo durante el mal tiempo',
  '',
  'LÍMITES:',
  '- NO des precios. Di: "Un técnico le dará una cotización exacta una vez que vea el trabajo."',
  '- NO prometas una hora exacta de llegada. Di: "Alguien del equipo se comunicará en los próximos [SLA del negocio] para confirmar la ventana de tiempo."',
  '- NO diagnostiques ni des consejos técnicos. Captura el síntoma y sigue.',
  '- Si la persona pide hablar con alguien en persona, di: "Por supuesto. Déjeme tomar sus datos para que la persona indicada le devuelva la llamada de inmediato," y captura los datos y termina la llamada.',
  '',
  'CIERRE DE LA LLAMADA:',
  '- Resume: "Para confirmar — [nombre], en [dirección], [problema], [urgencia]. Le devolveremos la llamada al [número] dentro de [ventana]. ¿Algo más que deba comunicar?"',
  '- Despídete con calidez: "Gracias por llamar. Estaremos en contacto muy pronto."'
].join('\n');

/** Bilingual auto-detect prompt — recommended default for US home services. */
const HOME_SERVICES_PROMPT_BILINGUAL = [
  'You are Sky, the bilingual AI front desk for a US home-services business. You speak fluent English and Spanish.',
  'Eres Sky, la recepcionista bilingüe de un negocio de servicios para el hogar en Estados Unidos. Hablas inglés y español con fluidez.',
  '',
  'GREETING / SALUDO:',
  '- Open every call bilingually: "Thanks for calling [Business]. This is Sky — para español, presione dos o solo siga hablando. How can I help you today?"',
  '- After the caller speaks 1–2 sentences, lock to whichever language they used and continue in that language for the rest of the call. If they switch mid-call, switch with them.',
  '- Never mix languages mid-sentence. Match the caller.',
  '',
  '== ENGLISH MODE ==',
  HOME_SERVICES_PROMPT_EN,
  '',
  '== MODO ESPAÑOL ==',
  HOME_SERVICES_PROMPT_ES,
  '',
  'LANGUAGE-DETECTION RULES:',
  '- If the caller answers the bilingual greeting in English (or says "English"), use the ENGLISH MODE rules above.',
  '- If the caller answers in Spanish (or says "español" / "Spanish") or presses 2, use MODO ESPAÑOL.',
  '- If the caller code-switches (Spanglish), default to whichever language carries the most content words; ask once: "¿Prefiere que sigamos en español o en inglés?"'
].join('\n');

/** Default voice per language. Tune in production. */
function defaultVoiceFor(language: AgentLanguage): string {
  switch (language) {
    case 'es':
      return 'shimmer'; // OpenAI Realtime — warm, works well in es-419
    case 'bilingual':
      return 'alloy'; // alloy renders both EN + ES naturally
    case 'en':
    default:
      return 'alloy';
  }
}

/** Pick the right base prompt for the requested language. */
function basePromptFor(language: AgentLanguage): string {
  switch (language) {
    case 'es':
      return HOME_SERVICES_PROMPT_ES;
    case 'bilingual':
      return HOME_SERVICES_PROMPT_BILINGUAL;
    case 'en':
    default:
      return HOME_SERVICES_PROMPT_EN;
  }
}

/** Normalize the language string from the DB to a known AgentLanguage. */
function normalizeLanguage(value: string | null | undefined): AgentLanguage {
  const normalized = (value ?? '').toLowerCase().trim();
  if (normalized.startsWith('es')) return 'es';
  if (normalized === 'bilingual' || normalized === 'multi' || normalized === 'auto') return 'bilingual';
  return 'en';
}

const DEFAULT_AGENT: AgentContext = {
  id: null,
  name: 'Sky',
  voiceName: defaultVoiceFor('bilingual'),
  language: 'bilingual',
  systemPrompt: HOME_SERVICES_PROMPT_BILINGUAL
};

/** Exported helper so other services (e.g. Retell agent provisioning) can reuse the prompt builder. */
export function buildHomeServicesPrompt(language: AgentLanguage, businessName?: string | null): string {
  const base = basePromptFor(language);
  if (!businessName || businessName.trim().length === 0) return base;
  const trimmed = businessName.trim();
  const businessFooter =
    language === 'es'
      ? `\n\nNOMBRE DEL NEGOCIO: ${trimmed}.\nCuando confirmes los datos, refiérete al negocio como "${trimmed}".`
      : `\n\nBUSINESS NAME: ${trimmed}.\nWhen the caller is ready to confirm, refer to the business as "${trimmed}".`;
  return `${base}${businessFooter}`;
}

/**
 * Loads the agent profile from the database, falling back to a default if not found.
 *
 * If the agent has a custom `systemPrompt`, it's used as-is. Otherwise, a prompt is
 * generated based on the agent's `language` field and the business name.
 *
 * @param agentProfileId - The AgentProfile ID from the phone number config, or null
 * @returns Resolved agent context with voice name, language, and system prompt
 */
export async function loadAgentContext(agentProfileId: string | null): Promise<AgentContext> {
  if (!agentProfileId) return DEFAULT_AGENT;

  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentProfileId },
    select: {
      id: true,
      name: true,
      voiceName: true,
      language: true,
      systemPrompt: true,
      business: { select: { name: true } }
    }
  });

  if (!agent) return DEFAULT_AGENT;

  const language = normalizeLanguage(agent.language);

  return {
    id: agent.id,
    name: agent.name,
    voiceName: agent.voiceName ?? defaultVoiceFor(language),
    language,
    systemPrompt: agent.systemPrompt ?? buildHomeServicesPrompt(language, agent.business.name)
  };
}
