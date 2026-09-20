import type { Metadata } from "next";
import Link from "next/link";
import SectionNav from "../components/SectionNav";

// Full content + style port of a reference page the user supplied
// (2026-09-20) - see docs/architecture.md. Only the site's own header/nav
// (SiteNav, via layout.tsx) and footer are kept; everything between them
// is this reference's content, verbatim, styled with its own scoped
// --rs-* palette (see globals.css's ".rs-page" block) rather than the
// site's shared --brand tokens - a deliberate exception, not an
// oversight, per the user's explicit "content AND style" instruction.
const SECTIONS = [
  { id: "your-result", label: "What your result means" },
  { id: "improve-your-text", label: "Improve your text" },
  { id: "i-wrote-it-myself", label: "I wrote it myself" },
  { id: "how-it-works", label: "How it works" },
  { id: "faqs", label: "Common questions" },
];

export const metadata: Metadata = {
  title: "Understanding results - AI Checker",
  description:
    "Understand your AI Checker result, confidence and highlights, and find practical ways to review your writing.",
};

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function ResultSupportPage() {
  return (
    <div className="container rs-page" style={{ paddingBottom: 64 }}>
      <h1>Understand your result</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        See what the labels mean, decide what to review, and make your writing clearer.
      </p>

      <SectionNav sections={SECTIONS} />

      <div className="rs-content-section" id="your-result">
        <h2>What does my result mean?</h2>
        <p className="rs-section-description">
          Your result is an estimate based on writing patterns. Read the overall label,
          percentage breakdown and highlights together.
        </p>

        <div className="rs-subsection">
          <h3>What does the conclusion at the top mean?</h3>
          <p>
            The sentence at the top summarises our assessment of your text, based on the balance
            of Human, Assisted and AI content and the confidence of the detection.
          </p>
          <ul className="rs-conclusion-list">
            <li>
              <strong>Fully human-written:</strong> All or nearly all of the text appears
              human-written. A small portion may show signs of AI assistance with low confidence.
            </li>
            <li>
              <strong>A mix of AI and human-written content:</strong> The text shows a
              combination of human writing and signs of AI generation or assistance.
            </li>
            <li>
              <strong>Fully AI-generated:</strong> Almost all of the text is identified as
              AI-generated with high confidence.
            </li>
          </ul>
          <p>The conclusion describes the text overall. The percentage breakdown and highlights show the details.</p>
        </div>

        <div className="rs-subsection">
          <h3>What does my percentage mean?</h3>
          <p>
            The main percentage combines the portions of your text marked AI and Assisted. It
            does not tell you the probability that the author used AI.
          </p>
          <div className="rs-percentage-example">
            <div className="rs-equation" role="img" aria-label="9 percent AI plus 16 percent Assisted equals 25 percent AI involvement">
              <span className="rs-equation-term rs-ai" aria-hidden="true">9% AI</span>
              <span aria-hidden="true">+</span>
              <span className="rs-equation-term rs-assisted" aria-hidden="true">16% Assisted</span>
              <span aria-hidden="true">=</span>
              <span className="rs-equation-term rs-total" aria-hidden="true">25% AI involvement</span>
            </div>
            <p>The remaining 75% is classified as Human.</p>
          </div>
        </div>

        <div className="rs-subsection">
          <h3>AI / Assisted / Human - what do the three categories mean?</h3>
          <div className="rs-table-shell">
            <table className="rs-category-table">
              <caption className="support-sr-only">Result categories and what they mean</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="rs-pill rs-human">Human</span></td>
                  <td data-label="What it means">
                    Classified as human-written. No meaningful AI involvement detected in this stretch.
                  </td>
                </tr>
                <tr>
                  <td><span className="rs-pill rs-assisted">Assisted</span></td>
                  <td data-label="What it means">
                    Shows characteristics of both human and AI writing. Most often this means
                    human-written text that was run through an AI tool to polish, rephrase, or
                    extend it, or an AI draft that was substantially hand-edited afterward.
                  </td>
                </tr>
                <tr>
                  <td><span className="rs-pill rs-ai">AI</span></td>
                  <td data-label="What it means">
                    Classified as likely AI-generated. Reads as generated by an AI model with no
                    meaningful human authorship.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="rs-info-note">
            <InfoIcon />
            <span>
              These categories are statistical estimates, not certainties and not legal proof.
              Highlights do not establish how the text was written. Treat every result as one
              input among several rather than the sole basis for a decision.
            </span>
          </p>
        </div>

        <div className="rs-result-notes">
          <div className="rs-note-card">
            <h3>What does the confidence badge mean?</h3>
            <p>Confidence describes how clear-cut the scoring was. It is separate from how much AI is in it.</p>
            <ul>
              <li><strong>High confidence</strong> - the model&apos;s scoring was decisive throughout.</li>
              <li>
                <strong>Medium confidence</strong> - some parts of the text scored closer to the
                boundary between categories. Treat it as a somewhat softer signal.
              </li>
              <li>
                <strong>Low confidence</strong> - a meaningful portion of the text was genuinely
                ambiguous to the model. This can happen with short texts, very formal or
                old-fashioned-sounding prose, heavily quoted material, or text in an unusual
                style. Consider it alongside other context you have about where the text came
                from.
              </li>
            </ul>
          </div>
          <div className="rs-note-card">
            <h3>Where does AI involvement appear in the text?</h3>
            <p>The location description, highlights and &quot;Start of text&quot; to &quot;End of text&quot; strip show where flagged passages appear.</p>
          </div>
        </div>
      </div>

      <div className="rs-content-section" id="improve-your-text">
        <h2>How can I reduce AI flags?</h2>
        <p className="rs-section-description">
          Focus on making the ideas and wording your own. These edits can improve your writing,
          but cannot guarantee a lower score.
        </p>
        <ol className="rs-steps">
          <li>
            <div>
              <strong>Start with your main point</strong>
              <p>Write down what you mean, why it matters, and what supports it.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Rewrite from your notes</strong>
              <p>Set the existing text aside and explain the idea in your own words.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Add specific, true details</strong>
              <p>Use relevant examples, observations, or evidence you can support.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Show your reasoning</strong>
              <p>Explain why your evidence matters and how you reached your conclusion.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Edit for clarity</strong>
              <p>Remove repetition and filler. Keep a tone that suits your audience.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Read aloud and recheck</strong>
              <p>Fix awkward wording, then compare the same complete passage.</p>
            </div>
          </li>
        </ol>

        <div className="rs-rewrite-examples">
          <h3>What does a useful rewrite look like?</h3>
          <p>Illustrative examples. Use details only when they are true for you.</p>
          <div className="rs-table-shell">
            <table className="rs-rewrite-table">
              <caption className="support-sr-only">Three illustrative examples of more specific writing</caption>
              <thead>
                <tr>
                  <th scope="col">General wording</th>
                  <th scope="col">More specific wording</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="General wording">Effective communication plays a crucial role in improving team productivity.</td>
                  <td data-label="More specific wording">Our handovers work better when each task has a named owner and a deadline.</td>
                </tr>
                <tr>
                  <td data-label="General wording">This innovative solution enhances efficiency and optimizes productivity.</td>
                  <td data-label="More specific wording">The tool copies order details into our planning sheet, so the team enters the information once.</td>
                </tr>
                <tr>
                  <td data-label="General wording">The project provided valuable learning opportunities.</td>
                  <td data-label="More specific wording">Two suppliers cancelled during the project. Next time, I would confirm a backup supplier before setting the delivery date.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="rs-info-note">
            <InfoIcon />
            <span>These are writing examples, not detector test results.</span>
          </p>
        </div>
      </div>

      <div className="rs-content-section" id="i-wrote-it-myself">
        <h2>I wrote it myself. Why was it flagged?</h2>
        <p className="rs-section-description">
          Detectors can make mistakes. Before rewriting, check your text and keep evidence of
          your writing process.
        </p>
        <ul className="rs-writing-evidence">
          <li>Check a complete passage with its surrounding context.</li>
          <li>Review uploaded text for missing words or broken formatting.</li>
          <li>Look at changes introduced by rewriting tools.</li>
          <li>Keep your notes, drafts, sources and version history.</li>
        </ul>
        <p>
          Still think the result is wrong? Email <a href="mailto:support@werida.io">support@werida.io</a>{" "}
          with a link to the result - we do look at these individually.
        </p>
      </div>

      <div className="rs-content-section" id="how-it-works">
        <h2>How does AI Checker check my text?</h2>
        <p>
          AI Checker analyses patterns in word choice, sentence structure and how ideas connect.
          It uses these patterns to assess whether writing resembles AI-generated text.
        </p>
        <p>
          Your result includes an overall label, an AI involvement percentage, a category
          breakdown, confidence and highlighted passages.
        </p>
        <p>
          Open your individual report from <Link href="/dashboard/history">History</Link>. Read
          highlighted sentences with the surrounding text. Results are estimates and can flag
          text you wrote yourself.
        </p>
      </div>

      <div className="rs-content-section" id="faqs">
        <h2>Common questions</h2>
        <div className="rs-faqs">
          <details className="rs-faq">
            <summary>
              <span>Why is my result &quot;Human written&quot; when some text is highlighted?</span>
              <ChevronIcon />
            </summary>
            <div className="rs-faq-answer">
              <p>
                &quot;Human written&quot; is the overall assessment of your text. Some passages
                may still be classified as Assisted and highlighted in yellow. Read the
                percentage breakdown and highlights alongside the overall label.
              </p>
            </div>
          </details>

          <details className="rs-faq" id="editing-context">
            <summary>
              <span>Why do percentages and highlights change after editing?</span>
              <ChevronIcon />
            </summary>
            <div className="rs-faq-answer">
              <p>
                AI Checker analyses patterns across passages of text. Longer passages generally
                provide more context and support a more reliable assessment than a single
                sentence.
              </p>
              <p>
                The surrounding sentences may influence how a sentence is assessed. When you add,
                remove or rewrite nearby text, you change that context. This may explain why a
                sentence receives a different highlight after a new check, even when its wording
                stays exactly the same.
              </p>
              <p>
                The percentages are also recalculated for the updated text. Removing one
                highlighted passage can therefore change both the overall breakdown and the
                highlights elsewhere.{" "}
                <strong>Recheck the complete passage and review highlighted sentences alongside the surrounding text.</strong>
              </p>
            </div>
          </details>

          <details className="rs-faq">
            <summary>
              <span>Can grammar or rewriting tools affect my result?</span>
              <ChevronIcon />
            </summary>
            <div className="rs-faq-answer">
              <p>
                Rewriting can change the patterns the detector analyses. The result alone cannot
                establish which tool was used or distinguish a grammar correction from
                substantial AI rewriting.
              </p>
            </div>
          </details>

          <details className="rs-faq">
            <summary>
              <span>Will another detector give me the same score?</span>
              <ChevronIcon />
            </summary>
            <div className="rs-faq-answer">
              <p>
                Not necessarily. Detectors use different models and scoring methods, so their
                percentages may mean different things. Compare the explanations and highlighted
                passages as well as the headline score.
              </p>
            </div>
          </details>

          <details className="rs-faq">
            <summary>
              <span>Will a humanizer fix my result?</span>
              <ChevronIcon />
            </summary>
            <div className="rs-faq-answer">
              <p>
                There is no guarantee. Rewritten text can still be flagged. Revise from your own
                notes, add accurate details and check that any edits preserve your meaning.
              </p>
            </div>
          </details>

          <details className="rs-faq">
            <summary>
              <span>Is this a plagiarism check?</span>
              <ChevronIcon />
            </summary>
            <div className="rs-faq-answer">
              <p>
                No. This check estimates AI involvement in your writing. Plagiarism checking
                compares text with existing sources. Review quotations and references separately.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className="rs-bottom-cta">
        <h2>Still have a question about a specific result?</h2>
        <p>
          Email <a href="mailto:support@werida.io">support@werida.io</a> with a link to the
          result (use the Share result button) and we&apos;ll take a look.
          <br />
          For everything else, see the main <Link href="/support">Support</Link> page.
        </p>
      </div>
    </div>
  );
}
