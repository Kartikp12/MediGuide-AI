# MediGuide AI 🩺

### AI-Powered Healthcare Information Assistant

MediGuide AI is an AI-powered healthcare information assistant designed to make general health information more accessible through conversational AI, medical web search, and browser-based voice interaction.

Built with **Next.js, Cloudflare Workers AI, LangGraph.js, and Tavily**, the application combines an AI-driven response workflow with medical-source retrieval and rule-based safety checks. Users can ask health-related questions through text chat or interact with the assistant using an English voice interface.

> **Disclaimer:** MediGuide AI provides general health information for educational purposes only. It is not a medical device, does not provide a professional diagnosis, and does not replace a qualified healthcare professional.

---

## 📸 🖥️ Application Preview

### 1. Home Dashboard

<!-- Home UI Screenshot: Replace this comment with your dashboard screenshot -->

![MediGuide AI Home Dashboard](docs/screenshots/home-ui.png)

The dashboard provides a central entry point to the text-based health assistant and in-app AI calling interface.

### 2. AI Health Chat

<!-- Chat UI Screenshot: Replace this comment with your chat interface screenshot -->

![MediGuide AI Chat Interface](docs/screenshots/chat-ui.png)

The chat interface allows users to ask health-related questions, view conversational responses, and access relevant medical source links when available.

### 3. AI Calling Interface

<!-- Call UI Screenshot: Replace this comment with your AI calling screenshot -->

![MediGuide AI Call Interface](docs/screenshots/call-ui.png)

The voice interface uses browser speech recognition and speech synthesis to support spoken questions and audio responses in English (India), subject to browser and device support.

### 4. Medical Response and Sources

<!-- Medical Response Screenshot: Replace this comment with a screenshot showing a response and its sources -->

![Medical Response and Sources](docs/screenshots/medical-response.png)

Medical queries can be routed through the medical-source search workflow before response generation. Source links are displayed when relevant sources are returned.

---

## ✨ Key Features

- **AI Health Chat:** Conversational interface for general health information.
- **In-App Voice Interaction:** Push-to-talk speech input and spoken AI responses.
- **Cloudflare Workers AI:** Uses the GLM-4.7-Flash model for response generation.
- **Medical Web Search:** Retrieves potentially relevant medical information through Tavily.
- **LangGraph Workflow:** Routes requests through conditional processing nodes.
- **Source-Aware Responses:** Supplies retrieved medical evidence to the model and displays returned source links.
- **Emergency Response Rules:** Detects selected emergency-related phrases and returns predefined urgent-care guidance.
- **Medical Intake Checks:** Requests essential information, such as age, symptom duration, allergies, and current medications, for queries classified as personal symptom or medicine questions.
- **Medication Dosage Guard:** Checks whether numerical medication quantities in a generated response appear in the retrieved source text and blocks responses with unsupported quantities.
- **Responsive UI:** Dashboard, chat, and calling interfaces designed with Tailwind CSS.
- **Error Handling:** Handles missing configuration, empty AI responses, request failures, and timeouts.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Next.js — Pages Router | Frontend application and API routes |
| React | Interactive UI and application state |
| JavaScript / JSX | Application logic and components |
| Tailwind CSS | Responsive styling |
| Cloudflare Workers AI | LLM inference and response generation |
| GLM-4.7-Flash | Configured AI model |
| LangGraph.js | Conditional AI workflow orchestration |
| Tavily Search API | Medical information retrieval |
| Web Speech API | Browser-based speech recognition and speech synthesis |
| Node.js | JavaScript runtime for the application and API routes |

---

## 🏗️ System Architecture

MediGuide AI follows a request-processing architecture that connects the frontend, API layer, workflow orchestration, medical search, and LLM inference.

```text
                     ┌──────────────────────┐
                     │      User Interface  │
                     │   Next.js + React    │
                     └──────────┬───────────┘
                                │
                   ┌────────────┴────────────┐
                   │                         │
             Text Chat                 Voice Interface
                   │                         │
                   │                  Speech Recognition
                   │                         │
                   └────────────┬────────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │    /api/chat         │
                     │   Request Handling   │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │   Safety Checks      │
                     │ Emergency / Intake   │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │  LangGraph Workflow  │
                     │   Request Routing    │
                     └──────────┬───────────┘
                                │
                     ┌──────────┴───────────┐
                     │                      │
               General Query           Medical Query
                     │                      │
                     │                      ▼
                     │             ┌─────────────────┐
                     │             │ Tavily Search   │
                     │             │ Medical Sources │
                     │             └────────┬────────┘
                     │                      │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │ Cloudflare Workers AI│
                     │  GLM-4.7-Flash       │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │ Response Validation  │
                     │ Dosage Guard         │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │ UI Response / Voice  │
                     └──────────────────────┘
```

*Architecture note: The diagram is a conceptual overview. Emergency and intake checks can return a response before the LangGraph workflow runs. Voice interaction sends recognized text through the existing chat endpoint; speech synthesis runs in the browser.*

---

## 🔄 AI Workflow

The backend uses LangGraph.js to coordinate conditional processing.

### 1. Request Handling

The `/api/chat` endpoint accepts conversation messages, validates the request, and identifies the latest user message.

### 2. Safety Checks

Before invoking the AI workflow, the application checks selected emergency-related phrases. It can return predefined emergency guidance without waiting for an LLM response.

For personal symptom and medicine queries, the application also checks for required intake information.

### 3. Conditional Routing

The `route_request` node classifies the latest request using the application's current symptom and medicine detection rules.

- **General query:** Proceeds directly to response generation.
- **Medical query:** Proceeds to medical-source retrieval before response generation.

### 4. Medical Source Retrieval

The `search_medical_sources` node calls Tavily, filters returned results against configured trusted domains and basic relevance rules, and prepares an evidence context for the model.

### 5. LLM Response Generation

The `generate_response` node sends the system instructions, conversation history, and available evidence to Cloudflare Workers AI.

### 6. Response Validation

The `validate_response` node checks that the generated response contains user-facing text. It also applies a basic source-text matching guard to numerical medication quantities.

### 7. Response Delivery

The API returns the response and relevant source metadata to the frontend. In voice mode, the browser can read the response aloud.

**Important limitation:** These checks are safeguards, not a clinical validation system. The dosage guard does not establish that the medicine, formulation, route, patient age, contraindications, and dose are clinically appropriate.

---

## 🔐 Medical Safety Approach

MediGuide AI incorporates several safeguards intended to reduce unsafe or misleading responses.

- **Emergency-first handling:** Selected emergency phrases trigger predefined urgent-care guidance.
- **Medical intake:** Requests additional information for supported personal symptom and medicine queries.
- **Evidence-aware prompting:** Instructs the model not to invent medical evidence or dosage instructions.
- **Source filtering:** Restricts retrieved results to configured domains and applies basic relevance checks.
- **Dosage response guard:** Blocks responses when detected numerical medication quantities cannot be found in the retrieved source text.
- **Clear limitations:** Communicates that AI-generated health information does not replace professional medical care.

These safeguards are intentionally limited. Phrase matching can miss emergencies, search snippets may be incomplete, and a quantity appearing in a source does not prove that a medication recommendation is safe.

For severe or potentially life-threatening symptoms, users should seek emergency assistance rather than rely on an AI assistant.

---

## 🎙️ Voice Interaction

The AI Call interface provides browser-based voice interaction without requiring a separate real-time voice model.

**Current interaction flow:**

1. Start the in-app AI call.
2. Select English (India).
3. Tap the microphone button and speak.
4. Browser speech recognition converts speech into text.
5. The recognized text is sent to `/api/chat`.
6. MediGuide AI generates a response through the existing backend.
7. Browser speech synthesis reads the response aloud.
8. End the call when finished.

**Implementation details**

- Uses the browser's `SpeechRecognition` or `webkitSpeechRecognition` interface when available.
- Uses `SpeechSynthesisUtterance` for spoken output.
- Uses the existing Cloudflare AI backend instead of a separate voice-specific LLM.
- Requires microphone permission and browser support.

This is a push-to-talk experience, not a continuous telephone call. Recognition quality and available voices depend on the browser, operating system, and installed speech services.

---

## 📂 Project Structure

```text
mediguide-ai/
├── pages/
│   ├── api/
│   │   ├── chat.js          # AI workflow and medical safety checks
│   │   ├── search.js        # Standalone Tavily search endpoint
│   │   └── ...
│   ├── _app.js              # Application wrapper, if configured
│   └── index.js             # Dashboard, text chat, and AI Call UI
├── public/                  # Static assets
├── styles/                  # Global styles, if configured
├── docs/
│   └── screenshots/         # Suggested location for README screenshots
├── .env.local               # Local environment variables (not committed)
├── package.json
└── README.md
```

*This is a representative structure. Keep only the files and folders that actually exist in the repository.*

---

## ⚙️ Getting Started

### Prerequisites

- Node.js and npm
- A Cloudflare account with access to Workers AI
- A Cloudflare API token with the required permissions
- A Tavily API key for medical web search
- A modern browser for the voice interface

### 1. Clone the repository

```bash
git clone https://github.com/Kartikp12/MediGuide-AI.git
cd MediGuide-AI
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
TAVILY_API_KEY=your_tavily_api_key
```

Replace the placeholders with your own credentials. Never commit real API keys or tokens to GitHub.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Create a production build

```bash
npm run build
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier |
| `CLOUDFLARE_API_TOKEN` | API token used for Workers AI requests |
| `TAVILY_API_KEY` | API key used for Tavily search |

Keep `.env.local` private. Configure environment variables separately in any deployment environment.

---

## 🧪 Testing Checklist

Use these cases when validating changes:

- [ ] General health-information question returns a response.
- [ ] Supported medical query invokes the search workflow.
- [ ] Missing intake information triggers follow-up questions.
- [ ] A selected emergency phrase triggers predefined emergency guidance.
- [ ] Empty AI responses and API failures are handled gracefully.
- [ ] Unsupported numerical dosage quantities are blocked by the current guard.
- [ ] Retrieved source links are displayed correctly.
- [ ] Voice input works in a supported browser with microphone permission.
- [ ] Spoken responses work when a suitable browser voice is available.
- [ ] Ending a voice interaction stops active recognition and speech output.
- [ ] The production build completes successfully.

The checklist is a testing plan; check items only after verifying them in the running application.

---

## 🚧 Limitations and Future Improvements

- Improve medical source quality and verify evidence at the individual claim level.
- Strengthen dosage validation beyond simple quantity matching.
- Expand and test emergency detection across more phrasings and languages.
- Add automated API and workflow tests.
- Evaluate response quality, grounding, safety, latency, and failure handling.
- Improve voice accessibility and browser compatibility.
- Add optional conversation persistence only with appropriate privacy controls.
- Document deployment configuration and operational limitations.

---

## 🔒 Privacy and Security

- API credentials should remain server-side and must not be exposed in frontend code.
- Avoid committing `.env.local` or other secret files.
- Voice recognition and speech synthesis depend on browser capabilities; check the browser's privacy behavior before handling sensitive information.
- Do not enter unnecessary personally identifiable information or confidential medical records.
- Do not treat AI responses as a substitute for professional assessment.

---

## 🎯 Project Goals

MediGuide AI is a portfolio project exploring the practical integration of:

- LLM-powered application development
- Agentic workflow orchestration with LangGraph
- Retrieval and source-grounded response generation
- Rule-based safety checks
- Browser-based voice interaction
- Full-stack development with Next.js

The project demonstrates how these components can be integrated into a healthcare-information interface while making the limitations of AI-generated medical guidance explicit.

---

## 👨‍💻 Author

**Kartik Patil**

- GitHub: [@Kartikp12](https://github.com/Kartikp12)
- Project Repository
