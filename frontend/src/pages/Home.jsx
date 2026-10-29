import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section>
      <h1>Welcome to the Mountain Hut</h1>
      <p>Check when a table is available and book your meal.</p>
      <Link to="/search">Check availability</Link>
    </section>
  );
}
