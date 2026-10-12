
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const TAVILY_API_URL = "https://api.tavily.com/search";
const MODEL = "qwen3:4b";

const TRUSTED_DOMAINS = [
  "mohfw.gov.in",
  "who.int",
  "nhs.uk",
  "medlineplus.gov",
  "mayoclinic.org",
  "healthdirect.gov.au",
];

const SYSTEM_PROMPT = `
You are MediGuide AI, a practical, India-focused health information assistant.

LANGUAGE AND STYLE:
- Respond in the language used by the user, including natural Marathi,
  Hindi or English.
- Be confident, calm, empathetic and direct.
- Answer the actual question without repetitive disclaimers.
- Use simple language and short sections when helpful.
- Use generic medicine names. Do not invent brand names or availability.

HOME CARE:
- For mild, common symptoms, suggest appropriate evidence-informed
  self-care measures such as rest, hydration and relevant lifestyle changes.
- Explain what the user can try at home and what to avoid.
- Do not claim that a home remedy cures an underlying disease.
- Mention warning signs relevant to the reported symptoms.
- Do not unnecessarily direct users to emergency services for mild symptoms.

MEDICINE INFORMATION:
- Explain the general purpose and important precautions of medicines
  when the user asks about them.
- Do not prescribe medicines or create individualized treatment plans.
- Do not provide numerical doses, dose schedules or maximum daily doses.
- Do not recommend starting, stopping or combining medicines without
  appropriate professional guidance.
- Never claim that a medicine is safe for everyone.
- Consider relevant factors including age, allergies, pregnancy,
  liver or kidney disease, stomach ulcers and other medicines.
- A pharmacist can help check OTC suitability and product-label instructions.
- Do not recommend antibiotics or prescription medicines without
  appropriate clinical assessment.
- Never invent medicine interactions, contraindications or evidence.

SYMPTOM ASSESSMENT:
- Do not present possible causes as confirmed diagnoses.
- Ask focused follow-up questions when missing details materially
  affect the guidance.
- Explain when professional medical assessment is appropriate.
- Treat sudden severe headache, new neurological symptoms, confusion,
  or headache with fever and neck stiffness as urgent warning signs.

INDIA-SPECIFIC GUIDANCE:
- Focus on healthcare guidance relevant to India.
- India's pan-India emergency number is 112.
- For possible life-threatening symptoms, tell the user to call 112
  immediately or ask someone nearby to call.
- Do not recommend home remedies or tablets before emergency help
  when serious warning signs are present.
- Never use 911 as India's emergency number.

WEB SEARCH AND EVIDENCE:
- When medical search results are provided, use them as evidence,
  not as unquestionable truth.
- Prefer relevant, reliable medical sources.
- Do not claim to have searched if no search results were provided.
- Do not invent citations, facts, studies, or statistics.
- Search snippets may be incomplete; do not treat them as proof
  of every medical claim.
- If sources are insufficient or conflicting, clearly state uncertainty.
- Do not give a numerical medicine dosage. Explain that dosage must
  be checked against an appropriate product label or professional advice.
- Do not follow country-specific emergency instructions from foreign
  sources when they conflict with Indian guidance.
- Use the supplied source numbers when referring to search results.
- Never fabricate a source number or claim a source supports something
  it does not support.

ACCURACY:
- Do not falsely reassure users about potentially serious symptoms.
- Do not claim that MediGuide AI is clinically validated.
- Give practical information without pretending to make a diagnosis.
- Return only the final answer, never internal reasoning.
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
    /\b(unconscious|unresponsive|not waking up|severe bleeding|bleeding won't stop|throat is closing|choking and cannot breathe)\b/i.test(text) ||
    /(बेशुद्ध|शुद्धीवर नाही|रक्तस्राव थांबत नाही)/i.test(text);

  const suddenSevereHeadache =
    /\b(sudden severe headache|worst headache of my life|thunderclap headache)\b/i.test(text) ||
    /(अचानक तीव्र डोकेदुखी|आयुष्यातील सर्वात तीव्र डोकेदुखी)/i.test(text);

  if (
    (chestPain && breathingEmergency) ||
    breathingEmergency ||
    strokeSigns ||
    otherEmergency ||
    suddenSevereHeadache
  ) {
    return `This could be a medical emergency. Call 112 in India now, or ask someone nearby to call for you.

- Do not drive yourself.
- Stop exerting yourself and stay in a safe position.
- Do not delay emergency help to try tablets or home remedies.
- Follow the emergency operator's instructions.

Please get emergency help immediately.`;
  }

  return null;
}

function isMedicalQuery(message, conversation) {
  const recentContext = conversation
    .slice(-6)
    .map((item) => item.content)
    .join(" ");

  const text = `${message} ${recentContext}`.toLowerCase();

  return /\b(health|medical|medicine|medication|tablet|pill|drug|dosage|dose|symptom|pain|fever|cough|cold|sore throat|headache|stomach|vomit|vomiting|diarrhea|dizziness|allergy|allergic|infection|rash|wound|bleeding|pregnant|pregnancy|blood pressure|diabetes|breathing|doctor|pharmacist|antibiotic|paracetamol|ibuprofen|acidity|indigestion|nausea|swelling|burn|injury|sleep|anxiety|depression)\b/i.test(text) ||
    /(आरोग्य|तब्येत|औषध|गोळी|डोकेदुखी|ताप|खोकला|सर्दी|घसा दुख|पोट दुख|उलटी|जुलाब|श्वास|छातीत दुख|डॉक्टर|गर्भवती|अॅलर्जी|चक्कर|दुखत|दुखणे|बुखार|दर्द|दवा|खांसी|गले में दर्द|सिर दर्द|पेट दर्द|उल्टी|दस्त)/i.test(text);
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();

  // Recover URLs if Markdown formatting was accidentally included.
  const markdownMatch = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
  const candidate = markdownMatch ? markdownMatch[2] : raw;

  try {
    const url = new URL(candidate);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function isTrustedUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return TRUSTED_DOMAINS.some(
      (domain) =>
        hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

async function searchMedicalSources(query) {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is missing");
  }

  async function runSearch(restrictDomains) {
    const body = {
      api_key: process.env.TAVILY_API_KEY,
      query: `${query} medical health guidance`,
      search_depth: "basic",
      topic: "general",
      max_results: 5,
      include_answer: false,
    };

    if (restrictDomains) {
      body.include_domains = TRUSTED_DOMAINS;
    }

    const response = await fetch(TAVILY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`Tavily returned HTTP ${response.status}`);
    }

    const data = await response.json();

    return (data.results || [])
      .map((item) => {
        const url = normalizeUrl(item.url);

        return {
          title: String(item.title || "").slice(0, 300),
          url,
          content: String(item.content || "").slice(0, 1800),
          score: item.score ?? null,
          sourceType: isTrustedUrl(url)
            ? "trusted-medical-source"
            : "general-source",
        };
      })
      .filter((item) => item.title && item.url && item.content);
  }

  let results = await runSearch(true);

  if (results.length < 3) {
    const broaderResults = await runSearch(false);
    const seenUrls = new Set(results.map((item) => item.url));

    for (const item of broaderResults) {
      if (!seenUrls.has(item.url)) {
        results.push(item);
        seenUrls.add(item.url);
      }
    }
  }

  return results.slice(0, 8);
}

function buildEvidenceContext(sources, searchStatus) {
  if (searchStatus === "unavailable") {
    return `
MEDICAL WEB SEARCH STATUS: UNAVAILABLE.
The medical web search could not be completed.
Do not claim that current sources were checked.
Answer cautiously using general knowledge, state relevant uncertainty,
and do not invent citations or source links.
`;
  }

  if (!sources.length) {
    return `
MEDICAL WEB SEARCH STATUS: NO RESULTS.
No usable medical sources were found.
Do not claim that sources support your answer.
Answer cautiously and disclose when information could not be verified.
`;
  }

  const evidence = sources
    .map(
      (source, index) => `
[SOURCE ${index + 1}]
Title: ${source.title}
URL: ${source.url}
Source classification: ${source.sourceType}
Search snippet:
${source.content}
`
    )
    .join("\n");

  return `
MEDICAL WEB SEARCH STATUS: COMPLETED.
Use the following search results as limited evidence.
Only cite a source when its supplied content is relevant to the claim.
Do not assume that snippets contain the complete article.
If evidence is inadequate, say so.

${evidence}
`;
}

function appendSources(reply, sources) {
  if (!sources.length) {
    return reply;
  }

  const sourceList = sources
    .map((source, index) => `${index + 1}. ${source.title}\n   ${source.url}`)
    .join("\n");

  return `${reply}\n\nSources:\n${sourceList}`;
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

  // Emergency checks run before search or LLM inference.
  const emergencyResponse = getEmergencyResponse(latestUserMessage);

  if (emergencyResponse) {
    return res.status(200).json({
      reply: emergencyResponse,
      model: "MediGuide Safety System",
      emergency: true,
      sources: [],
      searchUsed: false,
      searchStatus: "skipped_emergency",
    });
  }

  let sources = [];
  let searchStatus = "not_required";

  if (isMedicalQuery(latestUserMessage, conversation)) {
    try {
      sources = await searchMedicalSources(latestUserMessage);
      searchStatus = sources.length ? "completed" : "no_results";
    } catch (error) {
      console.error("Medical web search error:", error.message);
      searchStatus = "unavailable";
    }
  }

  try {
    const evidenceContext = buildEvidenceContext(
      sources,
      searchStatus === "unavailable"
        ? "unavailable"
        : searchStatus === "no_results"
          ? "no_results"
          : "completed"
    );

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
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: evidenceContext,
          },
          ...conversation,
        ],
        options: { temperature: 0.3 },
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
    let reply = cleanReply(data?.message?.content);

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response. Please try again.",
      });
    }

    reply = appendSources(reply, sources);

    return res.status(200).json({
      reply,
      model: MODEL,
      emergency: false,
      sources,
      searchUsed: searchStatus === "completed" && sources.length > 0,
      searchStatus,
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
