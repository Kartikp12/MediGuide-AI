
const TAVILY_API_URL = "https://api.tavily.com/search";

const TRUSTED_DOMAINS = [
  "mohfw.gov.in",
  "who.int",
  "nhs.uk",
  "medlineplus.gov",
  "mayoclinic.org",
  "healthdirect.gov.au",
];

async function searchTavily(query, includeDomains = true) {
  const body = {
    api_key: process.env.TAVILY_API_KEY,
    query: `${query} medical health guidance`,
    search_depth: "basic",
    topic: "general",
    max_results: 5,
    include_answer: false,
  };

  if (includeDomains) {
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
    const details = await response.text();

    console.error("Tavily API error:", response.status, details);

    throw new Error(`Tavily API returned ${response.status}`);
  }

  const data = await response.json();

  return (data.results || []).map((item) => ({
    title: item.title || "",
    url: item.url || "",
    content: item.content || "",
    score: item.score ?? null,
    sourceType: TRUSTED_DOMAINS.some((domain) => {
      try {
        return new URL(item.url).hostname === domain ||
          new URL(item.url).hostname.endsWith(`.${domain}`);
      } catch {
        return false;
      }
    })
      ? "trusted-medical-source"
      : "general-source",
  }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      error: "Method not allowed. Use POST.",
    });
  }

  const { query } = req.body || {};

  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({
      error: "Please provide a search query.",
    });
  }

  if (!process.env.TAVILY_API_KEY) {
    return res.status(500).json({
      error: "Tavily API key is missing. Check your .env.local file.",
    });
  }

  const cleanQuery = query.trim().slice(0, 500);

  try {
    let results = await searchTavily(cleanQuery, true);

    // If trusted-domain search returns too few results,
    // retry with a broader search.
    if (results.length < 3) {
      const broaderResults = await searchTavily(cleanQuery, false);
      const seenUrls = new Set(results.map((item) => item.url));

      for (const item of broaderResults) {
        if (item.url && !seenUrls.has(item.url)) {
          results.push(item);
          seenUrls.add(item.url);
        }
      }
    }

    return res.status(200).json({
      query: cleanQuery,
      results: results.slice(0, 8),
      count: Math.min(results.length, 8),
    });
  } catch (error) {
    console.error("Medical search error:", error.message);

    return res.status(
      error.name === "TimeoutError" ? 504 : 502
    ).json({
      error:
        error.name === "TimeoutError"
          ? "Search took too long. Please try again."
          : "Unable to complete medical search. Check Tavily API status and credits.",
    });
  }
}
