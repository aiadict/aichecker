import type { Metadata } from "next";
import Link from "next/link";
import { CHROME_STORE_URL } from "@/lib/constants";
import SectionNav from "../components/SectionNav";

// Five broad groups, not one per card - each id below is just the first
// section in that stretch of the page; SectionNav's scroll-spy treats it
// as "active" for the whole stretch until the next group's id scrolls
// past. Deliberately kept to five short labels so the nav fits on one
// line rather than wrapping - mirrors a reference page's own grouping
// almost exactly (2026-09-19).
const SECTIONS = [
  { id: "verdict", label: "Your result" },
  { id: "what-to-do", label: "Improve your text" },
  { id: "rechecking", label: "I wrote it myself" },
  { id: "how-it-works", label: "How it works" },
  { id: "faqs", label: "Common questions" },
];

export const metadata: Metadata = {
  title: "Understanding your result - AI Checker",
  description:
    "A detailed, no-doubts walkthrough of every part of an AI Checker result: the verdict, the percentage, the AI/Assisted/Human breakdown, confidence, the positional bar, and the highlighted text.",
};

export default function ResultSupportPage() {
  return (
    <div className="container" style={{ paddingBottom: 64 }}>
      <h1>Understand your result</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        This page walks through each piece in order, top to bottom, so there&apos;s no ambiguity
        about what you&apos;re looking at or what to do next.
      </p>

      <SectionNav sections={SECTIONS} />

      <h3>What does my result mean?</h3>
      <p>
        Your result is an estimate based on writing patterns. Read the overall label, percentage
        breakdown and highlights together.
      </p>

      <div className="card" id="verdict">
        <h3>The verdict at the top</h3>
        <p>
          Every result starts with one sentence - something like{" "}
          <em>&quot;We believe that this text is fully human-written,&quot;</em>{" "}
          <em>&quot;We believe that this text is fully AI-generated,&quot;</em> or{" "}
          <em>&quot;We believe that this text is a mix of AI and human-written content.&quot;</em>
        </p>
        <p>
          This only says <strong>&quot;fully&quot;</strong> when the evidence is genuinely
          overwhelming - not just because one category is the largest. A document that&apos;s 55%
          human and 45% AI is a real mix, not &quot;mostly human.&quot;
        </p>
      </div>

      <div className="card" id="percentage">
        <h3>What does my percentage mean?</h3>
        <p>
          The large number under the verdict (e.g. <strong>41%</strong>) is the share of your
          text&apos;s words that our model classified as AI-generated or AI-assisted. It&apos;s{" "}
          <strong>not</strong> a probability that a human wrote the piece, and it&apos;s not a
          plagiarism score - just a proportion of what you submitted.
        </p>
        <div className="equation-example">
          <div className="equation" role="img" aria-label="29 percent AI plus 12 percent Assisted equals 41 percent AI involvement">
            <span className="equation-term ai" aria-hidden="true">29% AI</span>
            <span className="equation-op" aria-hidden="true">+</span>
            <span className="equation-term assisted" aria-hidden="true">12% Assisted</span>
            <span className="equation-op" aria-hidden="true">=</span>
            <span className="equation-term total" aria-hidden="true">41% AI involvement</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>The remaining 59% is classified as Human.</p>
        </div>

        <p className="muted" style={{ marginTop: 14 }}>
          A short document has fewer words to spread that percentage across, so a single AI-sounding
          sentence in a 60-word paragraph can swing the number more than the same sentence would in
          a 600-word one. Longer submissions generally give a more stable, more trustworthy
          percentage.
        </p>
      </div>

      <div className="card" id="breakdown">
        <h3>AI / Assisted / Human - the three categories</h3>
        <p>Every word in your text falls into exactly one of three buckets:</p>
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="pill human">Human</span></td>
                <td>Classified as human-written. No meaningful AI involvement detected in this stretch.</td>
              </tr>
              <tr>
                <td><span className="pill mixed">Assisted</span></td>
                <td>
                  Shows characteristics of both human and AI writing. Most often this means
                  human-written text that was run through an AI tool to polish, rephrase, or
                  extend it, or an AI draft that was substantially hand-edited afterward.
                </td>
              </tr>
              <tr>
                <td><span className="pill ai">AI</span></td>
                <td>
                  Classified as likely AI-generated. Reads as generated by an AI model with no
                  meaningful human authorship.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          The three percentages under the breakdown bar (e.g. <em>AI 29% · Assisted 12% · Human
          59%</em>) always add up to 100% - together they account for every word in the text.
        </p>
      </div>

      <div className="card" id="confidence">
        <h3>The confidence badge</h3>
        <p>
          Next to the percentage, a small badge reads <strong>High</strong>,{" "}
          <strong>Medium</strong>, or <strong>Low</strong> confidence. This is a separate
          measurement from the percentage itself - it tells you how clear-cut the underlying
          scoring was for <em>this particular text</em>, not how much AI is in it.
        </p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
          <li>
            <strong>High confidence</strong> - the model&apos;s scoring was decisive throughout;
            the result is unlikely to flip on a re-check of the same text.
          </li>
          <li>
            <strong>Medium confidence</strong> - some parts of the text scored closer to the
            boundary between categories. The overall verdict is still a reasonable read, but treat
            it as a somewhat softer signal.
          </li>
          <li>
            <strong>Low confidence</strong> - a meaningful portion of the text was genuinely
            ambiguous to the model. This can happen with short texts, very formal or
            old-fashioned-sounding prose, heavily quoted material, or text in an unusual style.
            Weigh a low-confidence result more lightly, and consider it alongside other context
            you have about where the text came from.
          </li>
        </ul>
      </div>

      <div className="card" id="positional-bar">
        <h3>Where in the text (the positional bar)</h3>
        <p>
          Below the breakdown, a sentence like <em>&quot;AI involvement is concentrated in the
          later part of this text&quot;</em> and a second, softer-colored bar show{" "}
          <strong>where</strong> in the document the AI/Assisted/Human stretches actually fall -
          left to right, matching the text&apos;s own reading order from start to end. Hover over
          any colored block to see its exact label and confidence.
        </p>
        <p className="muted">
          This bar is intentionally a different, paler color palette from the bold breakdown bar
          above it - the breakdown bar always reads AI→Assisted→Human by proportion, while this one
          reads by actual position in the text, which is very often a different order. They&apos;re
          answering two different questions (&quot;how much&quot; vs. &quot;where&quot;), not
          contradicting each other.
        </p>
      </div>

      <div className="card" id="highlighted-text">
        <h3>The highlighted text itself</h3>
        <p>
          The full text you submitted, with the exact stretches that scored AI or Assisted marked
          directly in red or yellow. This is the most precise view available - rather than a
          single number for the whole document, you can see <strong>exactly which sentences</strong>{" "}
          drove that number.
        </p>
        <p>
          In the extension, this view is collapsed behind a <strong>&quot;Show highlighted
          text&quot;</strong> toggle by default (the same text is already visible, editable, in the
          box below it) - click it to expand. On a shared result page it&apos;s shown directly.
        </p>
      </div>

      <div className="card" id="what-to-do">
        <h3>What to do with a mixed or AI-flagged result</h3>
        <p>
          If your goal is to move a result toward &quot;human-written&quot; - for a student
          revising an essay, or anyone wanting their own voice to come through clearly - the
          highlighted text view tells you exactly where to focus:
        </p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.9 }}>
          <li>Expand the highlighted text and find the red and yellow stretches.</li>
          <li>
            Rewrite those specific sentences in your own words - don&apos;t just swap a few words
            for synonyms, actually re-draft the idea the way you&apos;d naturally say it.
          </li>
          <li>Leave the unhighlighted (human) parts alone - they&apos;re not the problem.</li>
          <li>Paste the revised text back in and check again.</li>
        </ol>
        <p className="muted">
          This is exactly why editing and re-checking both happen in the same panel, right next to
          each other, instead of being two separate steps.
        </p>

        <h3 style={{ marginTop: 24 }}>What a useful rewrite actually looks like</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          The pattern that tends to get flagged is generic, safe-sounding phrasing that could apply
          to almost anything. Swapping in specific, true details about your own situation is what
          actually changes it - not just rewording the same generic sentence:
        </p>
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th scope="col">Generic phrasing</th>
                <th scope="col">Specific rewrite</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>&quot;This innovative solution enhances efficiency and improves outcomes.&quot;</td>
                <td>&quot;This script cuts our invoice-matching time from 20 minutes to about 3.&quot;</td>
              </tr>
              <tr>
                <td>&quot;Effective communication plays a crucial role in team success.&quot;</td>
                <td>
                  &quot;We stopped missing handoffs once every task had one named owner and a due
                  date.&quot;
                </td>
              </tr>
              <tr>
                <td>&quot;The project provided valuable insights and learning experiences.&quot;</td>
                <td>
                  &quot;Two suppliers fell through mid-project - next time I&apos;d lock in a backup
                  before setting the delivery date.&quot;
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          These are illustrations of the pattern, not a guarantee - use details only when
          they&apos;re actually true for your situation.
        </p>
      </div>

      <div className="card" id="rechecking">
        <h3>Why did my percentage or highlights change after I edited the text?</h3>
        <p>
          Sentences aren&apos;t scored in isolation - the model reads each one together with the
          text around it. That means editing or removing one sentence can shift the score of a
          neighboring sentence too, even if that neighbor&apos;s own wording didn&apos;t change at
          all, because the context it&apos;s being read alongside changed.
        </p>
        <p className="muted">
          Practically: always recheck the <strong>complete</strong> passage after an edit, not just
          the sentence you changed. And when comparing two versions of the same document, compare
          them whole rather than pulling out a single sentence from each - a sentence in isolation
          scores less reliably than the same sentence read in context.
        </p>
      </div>

      <div className="card" id="false-positive">
        <h3>I&apos;m confident I wrote every word myself - why was it flagged?</h3>
        <p>
          No detector, ours included, is right 100% of the time in both directions - text can score
          higher than it should without actually being AI-written. Before assuming the tool got it
          wrong, it&apos;s worth checking a few things:
        </p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9 }}>
          <li>
            Review the complete passage with its surrounding context, not a single sentence pulled
            out on its own - see <Link href="#rechecking">why results change</Link> above.
          </li>
          <li>
            Check for paste artifacts. Text copied from a PDF, Google Docs, or a CMS sometimes
            carries broken paragraph breaks or stray formatting that can distort scoring - try
            re-pasting as plain text and checking again.
          </li>
          <li>
            Think about whether you ran the text through a grammar or rewriting tool. Suggestion-
            based editors and &quot;improve my writing&quot; features can shift word-choice patterns
            enough to read as AI-influenced, even with no full AI draft involved anywhere.
          </li>
          <li>
            Very formal, repetitive, or old-fashioned prose - a heavily revised abstract, a legal
            document, non-native-English phrasing - occasionally reads as more AI-like than it
            should. This is a known limitation of statistical detectors generally, not unique to us.
          </li>
          <li>
            Keep your drafts, notes, and version history. If this result matters for something with
            real stakes - a grade, a job - your own working history is stronger evidence than
            arguing with any single tool&apos;s score.
          </li>
        </ul>
        <p className="muted">
          Checked all of that and still think the result is simply wrong? Email{" "}
          <a href="mailto:support@werida.io">support@werida.io</a> with a link to the result - we
          do look at these individually.
        </p>
      </div>

      <div className="card" id="how-it-works">
        <h3>How does AI Checker check my text?</h3>
        <p>
          AI Checker analyzes patterns in word choice, sentence structure, and how ideas connect
          to estimate how much of a text reads as AI-generated versus human-written. Every plan
          uses the same underlying detection quality - see <Link href="/pricing">pricing</Link>{" "}
          for what actually changes between plans (credits and monthly word allowance, not
          accuracy).
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          Results are estimates based on those patterns, not a definitive record of how a text was
          written - see <Link href="#limits">what this can&apos;t tell you</Link> and{" "}
          <Link href="#faqs">common questions</Link> below for the caveats that matter most.
        </p>
      </div>

      <div className="card" id="limits">
        <h3>What this result can&apos;t tell you</h3>
        <p>
          This is a strong statistical signal, not a certainty and not legal proof. It cannot tell
          you <em>which</em> AI tool (if any) was used, and it cannot distinguish &quot;written by
          AI&quot; from &quot;happens to read in a very formal or generic style&quot; with perfect
          reliability - unusually formal, repetitive, or old-fashioned human writing occasionally
          scores as more AI-like than it should, which is part of why the confidence badge exists.
          Treat every result as one input among several, especially for anything with real
          consequences for someone - grading, hiring, publishing decisions, and so on - rather than
          the sole basis for a decision.
        </p>
      </div>

      <div className="card" id="faqs">
        <h3>Common questions</h3>
        <div className="faq-list">
          <details className="faq-item">
            <summary>
              Why is my result &quot;human-written&quot; when some text is highlighted?
              <svg className="faq-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="faq-answer">
              <p>
                The verdict at the top is the overall assessment of the whole text - some
                individual sentences can still be classified as Assisted or AI and highlighted
                without changing that overall label, as long as they don&apos;t add up to enough
                to cross the &quot;fully&quot; threshold. See <Link href="#verdict">the verdict</Link>{" "}
                above for exactly how that threshold works. Read the verdict, the percentage, and
                the highlights together - not the verdict alone.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              Why did my percentage or highlights change after I edited the text?
              <svg className="faq-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="faq-answer">
              <p>
                Sentences aren&apos;t scored in isolation - the model reads each one together with
                the text around it, so editing one sentence can shift a neighbor&apos;s score too.
                See <Link href="#rechecking">why results change</Link> above for the full
                explanation and what to do about it.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              Can grammar or rewriting tools affect my result?
              <svg className="faq-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="faq-answer">
              <p>
                Yes. Grammar and phrasing suggestions change the exact word-choice and
                sentence-structure patterns the detector looks at, which can shift a result even
                when no full AI draft was ever involved. This result alone can&apos;t tell the
                difference between a light grammar pass and substantial AI rewriting - see{" "}
                <Link href="#false-positive">flagged your own writing?</Link> above for what to
                check.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              Will another AI detector give me the same score?
              <svg className="faq-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="faq-answer">
              <p>
                Not necessarily. Different detectors use different models and scoring methods, so
                a percentage from one isn&apos;t directly comparable to a percentage from another.
                If you&apos;re cross-checking a result somewhere, compare the explanations and
                flagged passages, not just the headline number.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              Will a paraphrasing or &quot;humanizer&quot; tool fix a flagged result?
              <svg className="faq-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="faq-answer">
              <p>
                Not reliably. Those tools change surface wording, but the underlying patterns our
                model looks at can survive the rewrite - and running AI-generated text through a
                second AI tool doesn&apos;t make it human-written. Genuinely rewriting the idea
                yourself (see <Link href="#what-to-do">what to do next</Link>) is the only
                approach that actually addresses the cause instead of the symptom.
              </p>
            </div>
          </details>

          <details className="faq-item">
            <summary>
              Is this the same as a plagiarism checker?
              <svg className="faq-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="faq-answer">
              <p>
                No. This estimates AI involvement in the writing itself - it doesn&apos;t compare
                your text against other sources the way a plagiarism checker does. Text can be
                100% human-written and still be plagiarized, or entirely original and still score
                as AI-influenced; they&apos;re answering two different questions. Check quotations
                and citations separately.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <h3>Still have a question about a specific result?</h3>
        <p style={{ marginBottom: 12 }}>
          Email <a href="mailto:support@werida.io">support@werida.io</a> with a link to the
          result (use the Share button on your dashboard, or the shared link if you already have
          one) and we&apos;ll take a look. For everything else, see the main{" "}
          <Link href="/support">Support</Link> page.
        </p>
        <a className="cta-button" href={CHROME_STORE_URL} target="_blank" rel="noreferrer" style={{ marginTop: 0 }}>
          Add to Chrome - it&apos;s free
        </a>
      </div>
    </div>
  );
}
