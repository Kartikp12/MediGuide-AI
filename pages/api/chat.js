const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL = "qwen3:4b";

const SYSTEM_PROMPT = `
You are MediGuide AI, an India-focused health information assistant.

SCOPE AND LANGUAGE:
- Focus on healthcare guidance relevant to people in India.
- Respond in the user's language, including English, Hindi or Marathi.
- Never give US emergency numbers such as 911.
- India's pan-India emergency number is 112.
- Answer directly in a confident, calm and helpful tone.

PRACTICAL HEALTH GUIDANCE:
- For common, mild symptoms, explain likely causes and practical,
  evidence-informed home-care measures.
- Suggest relevant steps such as hydration, rest, sleep, or other
  appropriate self-care measures when useful.
- When asked about medicines, explain relevant common over-the-counter
  options only when appropriate, their intended use, important risks,
  contraindications and label precautions.
- Do not invent medicine names, benefits, interactions or evidence.
- Do not prescribe prescription-only medicines or recommend antibiotics
  without a qualified clinician's assessment.
- Do not give individualized medicine doses.
- Consider age, pregnancy, allergies, medical conditions and other
  medicines when these could change whether an option is safe.
- Ask focused follow-up questions when important details are missing.
- Do not suggest a medicine or home remedy as a substitute for emergency
  assessment.
- Avoid repetitive disclaimers and unnecessary referrals for simple,
  general educational questions.
- Recommend medical assessment when the symptoms or situation warrant it.

MEDICAL ACCURACY:
- Never present a possible cause as a confirmed diagnosis.
- Never falsely reassure someone about serious symptoms.
- Do not claim this application is clinically validated.
- Use clear, practical explanations rather than long generic warnings.

EMERGENCIES:
- If symptoms could indicate an emergency, prioritize immediate action.
- For severe chest pain, serious breathing difficulty, stroke warning
  signs, unconsciousness, severe bleeding or a serious allergic reaction,
  clearly explain that urgent emergency help is needed.
- In India, tell the user to call 112 or ask someone nearby to call.
- Do not recommend trying tablets or home remedies first.
- Never delay emergency guidance to ask follow-up questions.

RESPONSE STYLE:
- For ordinary health questions, give practical and relevant answers.
- Use short headings or bullet points when helpful.
- Avoid repeating the same disclaimer at the end of every answer.
- Return only the final response, never internal reasoning.
`;

function cleanReply(content) {
  let reply = String(content || "").trim();
  const pattern = /<\/think>/gi;
  let match;
  let lastMarkerEnd = -1;

  while ((match = pattern.exec(reply)) !== null) {
    lastMarkerEnd = match.index + match[0].length;
  }

  if (lastMarkerEnd !== -1) {
    reply = reply.slice(lastMarkerEnd).trim();
  }

  return reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function getEmergencyResponse(message) {
  const text = String(message || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const breathingEmergency =
    /\b(severe breathing difficulty|severe shortness of breath|struggling to breathe|difficulty breathing|trouble breathing|shortness of breath|cannot breathe|can't breathe|unable to breathe|gasping for air)\b/i.test(text) ||
    /(श्वास घेण्यास त्रास|श्वास घ्यायला त्रास|सांस लेने में कठिनाई|सांस नहीं ले पा|दम घुट रहा)/i.test(text);

  const chestPain =
    /\b(severe chest pain|crushing chest pain|chest pain|chest pressure|tightness in (my )?chest)\b/i.test(text) ||
    /(छातीत दुखत|छातीत तीव्र वेदना|सीने में दर्द|सीने में तेज दर्द)/i.test(text);

  const strokeSigns =
    /\b(face drooping|facial droop|sudden weakness on one side|weakness on one side|sudden trouble speaking|slurred speech|sudden loss of vision)\b/i.test(text) ||
    /(चेहरा वाकडा|बोलता येत नाही|अचानक बोलण्यास त्रास|शरीराच्या एका बाजूला अशक्तपणा)/i.test(text);

  const otherEmergency =
    /\b(unconscious|unresponsive|not waking up|severe bleeding|bleeding won't stop|throat is closing|throat swelling with difficulty breathing|choking and cannot breathe)\b/i.test(text) ||
    /(बेशुद्ध|शुद्धीवर नाही|रक्तस्राव थांबत नाही)/i.test(text);

  if (
    (chestPain && breathingEmergency) ||
    /\b(severe|crushing)\s+chest pain\b/i.test(text) ||
    breathingEmergency ||
    strokeSigns ||
    otherEmergency
  ) {
    return `This could be a medical emergency. Call 112 in India now, or ask someone nearby to call for you.

- Do not drive yourself.
- Stop exerting yourself and sit or rest in a safe position.
- Do not delay emergency help to try tablets or home remedies.
- Follow the emergency operator's instructions.

Please get emergency help immediately.`;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  const { message, messages } = req.body || {};

  const conversation = Array.isArray(messages)
    ? messages
        .filter(
          (item) =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string" &&
            item.content.trim().length > 0
        )
        .slice(-20)
        .map((item) => ({
          role: item.role,
          content: item.content.trim().slice(0, 8000),
        }))
    : [];

  if (typeof message === "string" && message.trim()) {
    conversation.push({
      role: "user",
      content: message.trim().slice(0, 8000),
    });
  }

  if (conversation.length === 0) {
    return res.status(400).json({
      error: "Please provide a message.",
    });
  }

  if (conversation[conversation.length - 1].role !== "user") {
    return res.status(400).json({
      error: "The latest message must be from the user.",
    });
  }

  const latestUserMessage = conversation[conversation.length - 1].content;

  // Deterministic safety check runs BEFORE calling the language model.
  const emergencyResponse = getEmergencyResponse(latestUserMessage);

  if (emergencyResponse) {
    return res.status(200).json({
      reply: emergencyResponse,
      model: "MediGuide Safety System",
      emergency: true,
    });
  }

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        think: false,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          ...conversation,
        ],
        options: {
          temperature: 0.4,
        },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const details = await response.text();

      console.error("Ollama API error:", response.status, details);

      return res.status(502).json({
        error: "The local AI service returned an error.",
      });
    }

    const data = await response.json();
    const reply = cleanReply(data?.message?.content);

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response. Please try again.",
      });
    }

    return res.status(200).json({
      reply,
      model: MODEL,
      emergency: false,
    });
  } catch (error) {
    console.error("MediGuide chat error:", error.message);

    const timedOut =
      error.name === "TimeoutError" ||
      error.name === "AbortError";

    return res.status(timedOut ? 504 : 502).json({
      error: timedOut
        ? "The AI took too long to respond. Please try again."
        : "Unable to connect to Ollama. Check that Ollama is running.",
    });
  }
}