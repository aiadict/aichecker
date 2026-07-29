import Link from "next/link";
import { listChecks } from "@/lib/mock-store";

export default function HistoryPage() {
  const checks = listChecks(50);

  return (
    <div className="container">
      <h1>All Checks</h1>
      {checks.length === 0 ? (
        <p className="muted">
          No checks yet. Run one from the extension, or <code>POST /api/checks</code> locally.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Text</th>
              <th>Date</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <td>{c.textSnippet.slice(0, 60)}…</td>
                <td className="muted">{new Date(c.createdAt).toLocaleString()}</td>
                <td>
                  <Link href={`/history/${c.shareSlug}`}>
                    <span className={`pill ${c.predictionShort}`}>{c.predictionShort}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
