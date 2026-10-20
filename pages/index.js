
import Head from "next/head";
import { useState } from "react";

const features = [
  {
    icon: "💬",
    title: "AI Health Chat",
    description:
      "Ask general health questions and get helpful, easy-to-understand information.",
    action: "Open Text Chat",
    tab: "chat",
  },
  {
    icon: "🎙️",
    title: "In-App AI Call",
    description:
      "Speak with your AI health assistant in Marathi or English.",
    action: "Start AI Call",
    tab: "call",
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("home");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();

    if (!text || loading) return;

    const updatedMessages = [
      ...messages,
      { role: "user", content: text },
    ];

    setMessages(updatedMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to get an AI response.");
      }

      if (!data.reply) {
        throw new Error("The AI returned an empty response.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    if (loading) return;

    setMessages([]);
    setInput("");
    setError("");
  }

  return (
    <>
      <Head>
        <title>MediGuide AI | Your Health Assistant</title>
        <meta
          name="description"
          content="Your AI-powered health information assistant."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </Head>

      <div className="min-h-screen bg-[#f5f8fc] text-slate-800">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-7 md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-2xl text-white">
              ✚
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                MediGuide<span className="text-teal-600"> AI</span>
              </h1>
              <p className="text-xs text-slate-500">
                Your health companion
              </p>
            </div>
          </div>

          <p className="mb-3 mt-12 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Workspace
          </p>

          <nav className="space-y-2">
            {[
              { id: "home", icon: "⌂", label: "Dashboard" },
              { id: "chat", icon: "▤", label: "Text Chat" },
              { id: "call", icon: "◉", label: "AI Call" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === item.id
                    ? "bg-teal-50 text-teal-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <div className="mb-2 text-xl">🛡️</div>
            <h3 className="text-sm font-semibold">
              Your safety matters
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              MediGuide provides general health information, not a
              medical diagnosis.
            </p>
          </div>
        </aside>

        <main className="md:ml-64">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur md:px-10">
            <div className="md:hidden">
              <p className="font-bold">
                MediGuide<span className="text-teal-600"> AI</span>
              </p>
            </div>

            <div className="hidden md:block">
              <p className="text-sm text-slate-500">
                Your personal health information assistant
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-600">
              Cloudflare AI
              </span>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
            {activeTab === "home" && (
              <>
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-700 p-7 text-white md:p-11">
                  <div className="relative z-10 max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium">
                      <span>✦</span>
                      AI-powered health information
                    </span>

                    <h2 className="mt-6 text-3xl font-bold leading-tight md:text-5xl">
                      Better health
                      <br />
                      starts with the
                      <br />
                      right information.
                    </h2>

                    <p className="mt-4 max-w-lg text-sm leading-6 text-teal-50 md:text-base">
                      Ask questions, explore your symptoms, and learn
                      about your health with your AI-powered assistant.
                    </p>

                    <button
                      onClick={() => setActiveTab("chat")}
                      className="mt-7 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50"
                    >
                      Start a conversation →
                    </button>
                  </div>

                  <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[35px] border-white/10 md:right-8 md:top-10 md:h-80 md:w-80" />

                  <div className="pointer-events-none absolute bottom-[-90px] right-36 h-56 w-56 rounded-full bg-cyan-300/20 blur-2xl" />
                </section>

                <section className="mt-10">
                  <div className="mb-5">
                    <h2 className="text-xl font-bold">
                      How can I help you?
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose how you would like to interact with
                      MediGuide.
                    </p>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    {features.map((feature) => (
                      <article
                        key={feature.tab}
                        className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-lg"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-2xl">
                          {feature.icon}
                        </div>

                        <h3 className="mt-5 text-lg font-bold">
                          {feature.title}
                        </h3>

                        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
                          {feature.description}
                        </p>

                        <button
                          onClick={() => setActiveTab(feature.tab)}
                          className="mt-5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
                        >
                          {feature.action} →
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <h3 className="text-sm font-semibold text-amber-950">
                        Important health notice
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-amber-900/80">
                        This application provides educational
                        information and does not replace a qualified
                        healthcare professional. For a medical
                        emergency, contact local emergency services.
                      </p>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === "chat" && (
              <section className="mx-auto max-w-3xl">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setActiveTab("home")}
                    className="text-sm font-medium text-teal-700 hover:underline"
                  >
                    ← Back to Dashboard
                  </button>

                  <button
                    onClick={startNewChat}
                    disabled={loading}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + New Chat
                  </button>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-4 border-b border-slate-100 p-5 md:p-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-3xl">
                      🩺
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-xl font-bold">
                        AI Health Chat
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                      Powered by Cloudflare AI
                      </p>
                    </div>

                    <div className="ml-auto hidden items-center gap-2 sm:flex">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-slate-500">
                      Cloudflare Workers AI
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex min-h-[360px] max-h-[55vh] flex-col gap-5 overflow-y-auto p-5 md:p-6"
                    aria-live="polite"
                    aria-label="Conversation messages"
                  >
                    {messages.length === 0 && (
                      <div className="m-auto max-w-md py-10 text-center">
                        <div className="text-4xl">💬</div>
                        <h3 className="mt-4 text-lg font-semibold">
                          How can I help you today?
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Ask a general health question in English
                          or Marathi to begin your conversation.
                        </p>
                      </div>
                    )}

                    {messages.map((item, index) => (
                      <div
                        key={`${index}-${item.role}`}
                        className={`flex ${
                          item.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-4 py-3 md:max-w-[80%] ${
                            item.role === "user"
                              ? "rounded-br-sm bg-teal-700 text-white"
                              : "rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-800"
                          }`}
                        >
                          <p
                            className={`mb-1 text-xs font-semibold ${
                              item.role === "user"
                                ? "text-teal-100"
                                : "text-teal-700"
                            }`}
                          >
                            {item.role === "user"
                              ? "You"
                              : "MediGuide AI"}
                          </p>

                          <p className="whitespace-pre-wrap break-words text-sm leading-6">
                            {item.content}
                          </p>
                        </div>
                      </div>
                    ))}

                    {loading && (
                      <div
                        className="flex justify-start"
                        role="status"
                        aria-label="AI is generating a response"
                      >
                        <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="mb-2 text-xs font-semibold text-teal-700">
                            MediGuide AI
                          </p>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
                            Thinking...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mx-5 mb-4 rounded-xl border border-red-200 bg-red-50 p-4 md:mx-6"
                    >
                      <p className="text-sm text-red-700">
                        {error}
                      </p>
                      <button
                        onClick={() => setError("")}
                        className="mt-2 text-xs font-semibold text-red-700 underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={sendMessage}
                    className="border-t border-slate-100 p-4 md:p-6"
                  >
                    <div className="flex items-end gap-2">
                      <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        placeholder="Ask a health question... / आरोग्याबद्दल प्रश्न विचारा..."
                        rows={2}
                        maxLength={8000}
                        disabled={loading}
                        aria-label="Your health question"
                        className="min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
                      />

                      <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
                      >
                        {loading ? "..." : "Send ↑"}
                      </button>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      General health information only. Not a diagnosis
                      or a substitute for professional medical care.
                    </p>
                  </form>
                </div>
              </section>
            )}

            {activeTab === "call" && (
              <section className="mx-auto max-w-3xl">
                <button
                  onClick={() => setActiveTab("home")}
                  className="mb-6 text-sm font-medium text-teal-700 hover:underline"
                >
                  ← Back to Dashboard
                </button>

                <div className="overflow-hidden rounded-3xl bg-slate-950 text-white">
                  <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                    <div>
                      <h2 className="font-semibold">
                        MediGuide AI Call
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Private in-app voice experience
                      </p>
                    </div>

                    <span className="rounded-full bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
                      UI preview
                    </span>
                  </div>

                  <div className="px-6 py-16 text-center md:py-20">
                    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-teal-300/30 bg-teal-400/10 text-5xl shadow-[0_0_60px_rgba(45,212,191,0.12)]">
                      🩺
                    </div>

                    <h3 className="mt-7 text-2xl font-bold">
                      Your AI Health Assistant
                    </h3>

                    <p className="mt-2 text-sm text-slate-400">
                      Ready to help you explore general health information.
                    </p>

                    <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-slate-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Voice service not connected
                    </div>

                    <div className="mt-10 flex flex-wrap justify-center gap-4">
                      <button
                        onClick={() =>
                          alert(
                            "The call interface is ready for UI testing. Microphone and AI integration will be added in a later phase."
                          )
                        }
                        className="rounded-xl bg-teal-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-teal-400"
                      >
                        Start AI Call
                      </button>

                      <button
                        onClick={() => setActiveTab("chat")}
                        className="rounded-xl border border-white/15 px-6 py-3 font-medium transition hover:bg-white/10"
                      >
                        Switch to Text Chat
                      </button>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                  This is an interface preview, not a working voice call.
                  Microphone access, transcription, and speech output
                  will be implemented and tested separately.
                </p>
              </section>
            )}

            <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs leading-5 text-slate-400">
              MediGuide AI · Built for accessible health education
              <br />
              Not a substitute for professional medical care.
            </footer>
          </div>

          <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-slate-200 bg-white px-2 py-2 md:hidden">
            {[
              { id: "home", label: "Home", icon: "⌂" },
              { id: "chat", label: "Chat", icon: "▤" },
              { id: "call", label: "AI Call", icon: "◉" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-1 rounded-lg px-5 py-2 text-xs ${
                  activeTab === item.id
                    ? "font-semibold text-teal-700"
                    : "text-slate-500"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="h-16 md:hidden" />
        </main>
      </div>
    </>
  );
}
