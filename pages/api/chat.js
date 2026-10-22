import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const CLOUDFLARE_MODEL = "@cf/zai-org/glm-4.7-flash";
const CLOUDFLARE_API_BASE =
  "https://api.cloudflare.com/client/v4/accounts";
const TAVILY_API_URL = "https://api.tavily.com/search";

const TRUSTED_DOMAINS = [
  "nhs.uk",
  "medlineplus.gov",
  "mohfw.gov.in",
  "nhm.gov.in",
  "aiims.edu",
  "cdsco.gov.in",
  "who.int",
  "cdc.gov",
  "mayoclinic.org",
  "medindia.net",
  "1mg.com",
  "apollo247.com",
];

const SYSTEM_PROMPT = `
You are MediGuide AI, a helpful general-purpose AI assistant with a
focus on evidence-based healthcare information.

GENERAL BEHAVIOUR
- Answer the user's actual question directly and clearly.
- Respond in the user's language, including English, Marathi and Roman Marathi.
- Do not behave as a healthcare-only bot for non-medical questions.
- Avoid unnecessary refusals, generic disclaimers and repetitive questions.
- Never claim to have verified information or sources unless they were checked.

MEDICINE AND TABLET INFORMATION
- When a user asks about a medicine, tablet, syrup or other treatment,
  provide useful information rather than automatically refusing.
- When appropriate, identify relevant medicines by their generic names
  and explain common uses, potential benefits, common side effects,
  important precautions, contraindications and interactions.
- If the user asks which medicine may help with a symptom or condition,
  explain reasonable evidence-based options and how they differ.
- Do not automatically recommend one medicine without considering
  the user's stated circumstances and important safety factors.
- Distinguish general medicine education from an individualized prescription.
- Explain usual approved dosage information when supported by reliable
  sources and appropriate for the stated age group, formulation and route.
- Never invent a dose, dosing frequency, treatment duration or maximum dose.
- Consider age, weight, pregnancy status, allergies, medical conditions,
  other medicines and product strength when these materially affect safety.
- Ask only the essential follow-up questions needed to give a safe,
  relevant answer. Explain useful general information in the meantime.
- Do not recommend prescription-only medicines for unsupervised use.
- Do not recommend antibiotics without appropriate clinical assessment.
- Explain when a pharmacist or healthcare professional should be consulted.
- For possible overdose or serious adverse reactions, provide urgent guidance.

PREGNANCY AND CONTRACEPTION
- Explain contraception and emergency contraception options factually.
- Distinguish preventing pregnancy from terminating an established pregnancy.
- Explain medicine names, purposes, benefits, limitations, side effects
  and relevant precautions using reliable medical evidence.
- Do not automatically refuse reproductive-health questions.
- Do not confuse emergency contraceptives with abortion medicines.
- Ask a brief clarifying question when the user's situation is unclear
  and the distinction materially changes the answer.

MEDICAL SOURCES
- Use reliable, relevant medical sources for medicine-related claims.
- Prefer official health authorities, recognized medical references
  and applicable local guidance.
- Ensure the source matches the actual medicine, formulation, route,
  age group and question.
- Do not cite unrelated medicine pages or invent references.
- If reliable evidence is unavailable, explain the specific uncertainty
  rather than fabricating an answer.
- Include direct links to sources actually retrieved and used.

EMERGENCY SAFETY
- Recognize potentially life-threatening symptoms.
- In India, advise calling 112 for a medical emergency.
- Prioritize urgent care over routine questions when necessary.

RESPONSE STYLE
- Be practical, respectful, non-judgmental and informative.
- Explain benefits and risks in understandable language.
- Do not replace every medical answer with "consult a doctor."
- Do not guarantee that a medicine will work or is safe for everyone.
- Never claim to be a doctor or provide false certainty.
`;


function cleanReply(value) {
  return String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function getLatestUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content;
    }
  }

  return "";
}

function getAllUserText(messages) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
}

function getEmergencyResponse(text) {
  const patterns = [
    /\b(can't|cannot|unable to|difficulty|trouble) breathe\b/i,
    /\bsevere chest pain\b/i,
    /\bchest pain\b.*\b(shortness of breath|sweating|fainting)\b/i,
    /\b(stroke|face drooping|sudden weakness on one side|sudden trouble speaking)\b/i,
    /\b(unconscious|unresponsive|severe bleeding|choking)\b/i,
    /\b(throat|tongue|lips?)\b.*\b(swelling|swollen)\b.*\b(breathe|breathing|swallow)\b/i,
    /\bsevere allergic reaction\b/i,
    /\b(can't|cannot) swallow (saliva|my saliva)\b/i,
    /श्वास घ्यायला त्रास|श्वास घेता येत नाही|छातीत तीव्र दुखणे|बेशुद्ध|खूप रक्तस्राव/i,
    /shwas ghyayla tras|shwas gheta yet nahi|chhatit tivra dukhne|beshuddh/i,
  ];

  if (!patterns.some((pattern) => pattern.test(text))) {
    return null;
  }

  return (
    "Your symptoms may indicate a medical emergency. Call 112 in India " +
    "or go to the nearest emergency department now. Do not wait for an AI " +
    "response. If possible, have someone stay with you while help is arranged."
  );
}

function isMedicalQuery(text) {
  return (
    /\b(medicine|medication|drug|dosage|dose|tablet|pill|syrup|antibiotic|paracetamol|acetaminophen|cetirizine|amoxicillin|ibuprofen|aspirin|loratadine|omeprazole|metformin|dolo|symptom|symptoms|fever|headache|cough|cold|pain|rash|infection|allergy|allergic|pregnancy|blood pressure|diabetes|asthma|kidney|liver|chest pain|sore throat|side effect|treatment|diagnosis|health|medical|doctor|prescription|overdose|wound|vomiting|diarrhea|diarrhoea)\b|ताप|डोकेदुखी|खोकला|सर्दी|घसादुखी|पोटदुखी|कान दुख|अंगदुखी|उलटी|जुलाब|औषध|गोळी|तापमान|आरोग्य|डॉक्टर|छातीत दुखणे|श्वास/i
  ).test(text);
}

function isChildSpecificDoseQuery(text) {
  const mentionsChild =
    /\b(child|children|kid|kids|infant|baby|toddler|newborn|year-old)\b/i.test(
      text
    ) || /मुलाला|मुलीला|बाळाला|लहान मुला/i.test(text);

  const asksDose =
    /\b(dose|dosage|how many ml|how much|millilit|syrup|give|tablet|medicine|paracetamol|acetaminophen)\b/i.test(
      text
    ) || /किती मात्रा|किती एमएल|औषध किती/i.test(text);

  return mentionsChild && asksDose;
}

function hasChildWeight(text) {
  return /\b\d+(?:\.\d+)?\s*(?:kg|kilograms?|lbs?|pounds?)\b/i.test(text);
}

function hasMedicineConcentration(text) {
  return (
    /\b\d+(?:\.\d+)?\s*mg\s*\/\s*\d+(?:\.\d+)?\s*ml\b/i.test(text) ||
    /\b\d+(?:\.\d+)?\s*mg\s*per\s*\d+(?:\.\d+)?\s*ml\b/i.test(text) ||
    /\b\d+(?:\.\d+)?\s*mg\s*\/\s*ml\b/i.test(text)
  );
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return "";
    }

    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function getHostname(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isTrustedUrl(value) {
  const hostname = getHostname(value);

  return TRUSTED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

function getRequestedMedicine(query) {
  const medicines = [
    { name: "paracetamol", pattern: /\b(paracetamol|acetaminophen)\b/i },
    { name: "cetirizine", pattern: /\bcetirizine\b/i },
    { name: "amoxicillin", pattern: /\bamoxicillin\b/i },
    { name: "ibuprofen", pattern: /\bibuprofen\b/i },
    { name: "aspirin", pattern: /\baspirin\b/i },
    { name: "loratadine", pattern: /\bloratadine\b/i },
    { name: "omeprazole", pattern: /\bomeprazole\b/i },
    { name: "metformin", pattern: /\bmetformin\b/i },
    { name: "dolo", pattern: /\bdolo(?:\s*[- ]?\s*\d+)?\b/i },
  ];

  for (const medicine of medicines) {
    if (medicine.pattern.test(query)) {
      return medicine.name;
    }
  }

  return "";
}

function getMedicinePattern(medicine) {
  const patterns = {
    paracetamol: /\b(paracetamol|acetaminophen)\b/i,
    cetirizine: /\bcetirizine\b/i,
    amoxicillin: /\bamoxicillin\b/i,
    ibuprofen: /\bibuprofen\b/i,
    aspirin: /\baspirin\b/i,
    loratadine: /\bloratadine\b/i,
    omeprazole: /\bomeprazole\b/i,
    metformin: /\bmetformin\b/i,
    dolo: /\bdolo(?:\s*[- ]?\s*\d+)?\b/i,
  };

  return patterns[medicine] || null;
}

function isDoseQuestion(query) {
  return /\b(dose|dosage|how much|how many|maximum|daily limit|mg|milligram|milliliter|ml)\b/i.test(
    query
  );
}

function isAdultQuestion(query) {
  return /\b(adult|adults|for me|for myself)\b/i.test(query);
}

function isChildQuestion(query) {
  return /\b(child|children|kid|kids|infant|baby|toddler|newborn|paediatric|pediatric)\b/i.test(
    query
  );
}

function isRelevantSource(item, query) {
  const title = String(item.title || "").toLowerCase();
  const url = String(item.url || "").toLowerCase();
  const content = String(item.content || "").toLowerCase();
  const combined = `${title}\n${url}\n${content}`;
  const medicine = getRequestedMedicine(query);

  if (medicine) {
    const medicinePattern = getMedicinePattern(medicine);

    if (!medicinePattern || !medicinePattern.test(combined)) {
      return false;
    }

    const childQuestion = isChildQuestion(query);
    const adultQuestion = isAdultQuestion(query);

    const childOnlyPage =
      /\b(for children|in children|children's|paediatric|pediatric|child dose|dose for children)\b/i.test(
        title
      );

    const adultOnlyPage =
      /\b(for adults|in adults|adult dosage|adult dose)\b/i.test(title);

    if (adultQuestion && childOnlyPage && !adultOnlyPage) {
      return false;
    }

    if (childQuestion && adultOnlyPage && !childOnlyPage) {
      return false;
    }

    if (
      isDoseQuestion(query) &&
      !/\b(dose|dosage|mg|milligram|maximum|how to take|how much|taking|use|children|adult)\b/i.test(
        combined
      )
    ) {
      return false;
    }

    return true;
  }

  if (/\b(sore throat|throat pain|pharyngitis)\b/i.test(query)) {
    return /\b(sore throat|throat pain|pharyngitis|painful throat)\b/i.test(
      combined
    );
  }

  if (/\b(fever|temperature|febrile)\b/i.test(query)) {
    return /\b(fever|temperature|febrile)\b/i.test(combined);
  }

  const stopWords = new Set([
    "what",
    "which",
    "when",
    "where",
    "should",
    "could",
    "would",
    "please",
    "about",
    "with",
    "from",
    "have",
    "this",
    "that",
    "your",
    "tell",
    "explain",
    "medicine",
    "medical",
    "source",
    "sources",
    "treatment",
    "symptoms",
    "dose",
    "dosage",
    "usual",
    "adult",
    "adults",
    "maximum",
    "daily",
    "amount",
    "reliable",
    "provide",
    "direct",
    "answer",
    "using",
    "information",
    "supported",
    "precautions",
    "often",
    "taken",
    "tablets",
  ]);

  const keywords = query.toLowerCase().match(/[a-z]{4,}/g) || [];
  const meaningful = [...new Set(keywords)].filter(
    (word) => !stopWords.has(word)
  );

  return (
    meaningful.length === 0 ||
    meaningful.some((word) => combined.includes(word))
  );
}

function buildMedicalSearchQuery(query) {
  const medicine = getRequestedMedicine(query);
  const childQuestion = isChildQuestion(query);
  const adultQuestion = isAdultQuestion(query);
  const doseQuestion = isDoseQuestion(query);

  if (medicine) {
    const audience = childQuestion
      ? "children pediatric"
      : adultQuestion
        ? "adults"
        : "";

    const intent = doseQuestion
      ? "dosage directions dose frequency maximum daily dose warnings"
      : "uses precautions side effects contraindications interactions";

    return `${medicine} ${audience} official medical guidance ${intent}`.trim();
  }

  if (/\b(fever|temperature|febrile)\b/i.test(query)) {
    return `${query} trusted medical guidance fever self care warning signs`;
  }

  if (/\b(sore throat|throat pain|pharyngitis)\b/i.test(query)) {
    return `${query} trusted medical guidance sore throat self care warning signs`;
  }

  return `${query} reliable medical guidance treatment precautions warning signs`;
}

async function searchMedicalSources(query) {
  if (!process.env.TAVILY_API_KEY) {
    return { status: "unavailable", sources: [] };
  }

  const focusedQuery = buildMedicalSearchQuery(query);

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: focusedQuery,
        search_depth: "advanced",
        topic: "general",
        max_results: 10,
        include_answer: false,
        include_raw_content: "markdown",
        include_domains: TRUSTED_DOMAINS,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      return { status: "unavailable", sources: [] };
    }

    const data = await response.json();
    const seen = new Set();

    const sources = (Array.isArray(data.results) ? data.results : [])
      .map((item) => ({
        title: String(item.title || "").trim().slice(0, 300),
        url: normalizeUrl(item.url),
        content: String(item.raw_content || item.content || "")
          .trim()
          .slice(0, 8000),
        score: Number(item.score) || 0,
      }))
      .filter((item) => {
        if (
          !item.title ||
          !item.url ||
          !item.content ||
          !isTrustedUrl(item.url) ||
          seen.has(item.url) ||
          !isRelevantSource(item, query)
        ) {
          return false;
        }

        seen.add(item.url);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ title, url, content }) => ({ title, url, content }));

    return {
      status: sources.length
        ? "relevant_sources_found"
        : "no_relevant_sources",
      sources,
    };
  } catch {
    return { status: "unavailable", sources: [] };
  }
}

function buildEvidenceContext(sources, status) {
  if (status === "unavailable") {
    return (
      "Medical search was unavailable. Do not claim that sources were checked. " +
      "Answer general health questions with appropriate caution. Do not invent " +
      "citations or specific dosage recommendations."
    );
  }

  if (status === "no_relevant_sources") {
    return (
      "No relevant trusted medical sources were found for this question. " +
      "Do not cite unrelated sources. Answer general parts of the question " +
      "that can be explained safely, clearly disclose the missing evidence, " +
      "and do not invent a specific medicine dose."
    );
  }

  return (
    "Use the following search results as evidence, checking relevance and context. " +
    "Do not assume every detail in a result is correct for every patient.\n\n" +
    sources
      .map(
        (source, index) =>
          `SOURCE ${index + 1}\nTitle: ${source.title}\nURL: ${source.url}\nContent: ${source.content}`
      )
      .join("\n\n")
  );
}

function appendSources(reply, sources) {
  if (!sources.length || /\*\*Sources\*\*/i.test(reply)) {
    return reply;
  }

  const sourceList = sources
    .map((source) => `- [${source.title}](${source.url})`)
    .join("\n");

  return `${reply}\n\n**Sources**\n${sourceList}`;
}

async function callCloudflareAI(messages) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    const error = new Error(
      "Cloudflare AI credentials are not configured."
    );
    error.code = "CLOUDFLARE_CONFIG_MISSING";
    throw error;
  }

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/${accountId}/ai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLOUDFLARE_MODEL,
        messages,
        max_completion_tokens: 1600,
        temperature: 0.2,
        chat_template_kwargs: {
          enable_thinking: false,
          clear_thinking: true,
        },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false || data.error) {
    const error = new Error("Cloudflare Workers AI request failed.");
    error.code = "CLOUDFLARE_REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }

  const reply = cleanReply(data?.choices?.[0]?.message?.content);

  if (!reply) {
    const error = new Error(
      "Cloudflare AI returned no user-facing text."
    );
    error.code = "CLOUDFLARE_EMPTY_RESPONSE";
    throw error;
  }

  return reply;
}

const MediGuideState = Annotation.Root({
  messages: Annotation({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  latestUserMessage: Annotation({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  searchQuery: Annotation({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  medicalQuery: Annotation({
    reducer: (_current, update) => update,
    default: () => false,
  }),
  sources: Annotation({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  searchStatus: Annotation({
    reducer: (_current, update) => update,
    default: () => "not_required",
  }),
  systemPrompt: Annotation({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  reply: Annotation({
    reducer: (_current, update) => update,
    default: () => "",
  }),
});

function routeRequest(state) {
  const medicalQuery = isMedicalQuery(state.latestUserMessage);

  return {
    medicalQuery,
    searchStatus: medicalQuery ? "pending" : "not_required",
    sources: [],
    systemPrompt:
      `${SYSTEM_PROMPT}\n\n` +
      (medicalQuery
        ? "This is a medical or health-related question. Medical search will run before you answer."
        : "This is a general assistant request. Answer it directly and helpfully."),
  };
}

async function searchMedicalSourcesNode(state) {
  const result = await searchMedicalSources(state.searchQuery);
  const evidence = buildEvidenceContext(result.sources, result.status);

  return {
    sources: result.sources,
    searchStatus: result.status,
    systemPrompt:
      `${state.systemPrompt}\n\n` +
      `MEDICAL SEARCH STATUS: ${result.status}\n\n${evidence}`,
  };
}

async function generateResponseNode(state) {
  const reply = await callCloudflareAI([
    {
      role: "system",
      content: state.systemPrompt,
    },
    ...state.messages,
  ]);

  return { reply };
}

function validateResponseNode(state) {
  const reply = cleanReply(state.reply);

  if (!reply) {
    const error = new Error(
      "Cloudflare AI returned no user-facing text."
    );
    error.code = "CLOUDFLARE_EMPTY_RESPONSE";
    throw error;
  }

  // Keep useful answers; do not replace them with a generic refusal
  // because a simple text-matching dosage validator failed.
  return { reply };
}

const mediGuideGraph = new StateGraph(MediGuideState)
  .addNode("route_request", routeRequest)
  .addNode("search_medical_sources", searchMedicalSourcesNode)
  .addNode("generate_response", generateResponseNode)
  .addNode("validate_response", validateResponseNode)
  .addEdge(START, "route_request")
  .addConditionalEdges(
    "route_request",
    (state) =>
      state.medicalQuery
        ? "search_medical_sources"
        : "generate_response",
    {
      search_medical_sources: "search_medical_sources",
      generate_response: "generate_response",
    }
  )
  .addEdge("search_medical_sources", "generate_response")
  .addEdge("generate_response", "validate_response")
  .addEdge("validate_response", END)
  .compile();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const rawMessages = Array.isArray(body.messages)
    ? body.messages
    : body.message
      ? [{ role: "user", content: String(body.message) }]
      : [];

  const messages = rawMessages
    .filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 8000),
    }));

  const latestUserMessage = getLatestUserMessage(messages);

  if (!latestUserMessage) {
    return res.status(400).json({
      error: "A user message is required.",
    });
  }

  const emergencyReply = getEmergencyResponse(latestUserMessage);

  if (emergencyReply) {
    return res.status(200).json({
      reply: emergencyReply,
      model: CLOUDFLARE_MODEL,
      emergency: true,
      sources: [],
      searchUsed: false,
      searchStatus: "skipped_for_emergency",
    });
  }

  // Do not guess a child's liquid medicine dose when weight or concentration
  // is missing.
  if (isChildSpecificDoseQuery(latestUserMessage)) {
    const allText = getAllUserText(messages);
    const missing = [];

    if (!hasChildWeight(allText)) {
      missing.push("the child's current weight");
    }

    if (!hasMedicineConcentration(allText)) {
      missing.push("the exact concentration printed on the bottle");
    }

    if (missing.length > 0) {
      const reply =
        "For a child's medicine dose, the child's weight and the exact " +
        "product concentration are important. Please check:\n\n" +
        missing.map((item) => `- ${item}`).join("\n") +
        "\n\nMeanwhile, offer fluids regularly and monitor the child's " +
        "condition. Seek urgent care for difficulty breathing, unusual " +
        "drowsiness, a seizure, signs of dehydration, or if the child " +
        "appears seriously unwell. Do not guess the dose.";

      return res.status(200).json({
        reply,
        model: CLOUDFLARE_MODEL,
        emergency: false,
        sources: [],
        searchUsed: false,
        searchStatus: "intake_required",
        missingInformation: missing,
      });
    }
  }

  const medicalQuery = isMedicalQuery(latestUserMessage);
  const searchQuery = latestUserMessage.slice(0, 1500);

  let sources = [];
  let searchStatus = medicalQuery ? "pending" : "not_required";

  try {
    const result = await mediGuideGraph.invoke({
      messages,
      latestUserMessage,
      searchQuery,
    });

    sources = result.sources || [];
    searchStatus =
      result.searchStatus || (medicalQuery ? "unknown" : "not_required");

    const reply = appendSources(cleanReply(result.reply), sources);

    return res.status(200).json({
      reply,
      model: CLOUDFLARE_MODEL,
      emergency: false,
      sources,
      searchUsed: Boolean(result.medicalQuery),
      searchStatus,
    });
  } catch (error) {
    const timedOut =
      error?.name === "TimeoutError" ||
      error?.name === "AbortError";

    const missingConfig =
      error?.code === "CLOUDFLARE_CONFIG_MISSING";

    const emptyResponse =
      error?.code === "CLOUDFLARE_EMPTY_RESPONSE";

    const status = timedOut ? 504 : 502;

    const message = missingConfig
      ? "Cloudflare AI is not configured. Check CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env.local, then restart the development server."
      : emptyResponse
        ? "Cloudflare AI returned an empty response. Please try again."
        : timedOut
          ? "The AI took too long to respond. Please try again."
          : "Could not get a response from Cloudflare AI. Check the Cloudflare AI configuration and try again.";

    return res.status(status).json({
      error: message,
      model: CLOUDFLARE_MODEL,
      emergency: false,
      sources,
      searchUsed: medicalQuery,
      searchStatus,
    });
  }
}