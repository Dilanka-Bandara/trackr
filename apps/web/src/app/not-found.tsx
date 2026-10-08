import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>That page has moved on.</h1>
      <p>Let’s get you back to your next opportunity.</p>
      <Link className="button button-primary" href="/app">
        Go to your workspace
      </Link>
    </main>
  );
}
