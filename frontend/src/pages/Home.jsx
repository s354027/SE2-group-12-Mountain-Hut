import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home-page home-page-simple">
      <section className="home-welcome" aria-labelledby="home-title">
        <span className="home-welcome-eyebrow">WELCOME TO MOUNTAIN HUT</span>
        <h1 id="home-title">A place to rest along the way.</h1>
        <p>Planning a mountain day? Stop by for lunch or dinner. Check table availability and reserve your place in just a few steps.</p>
        <Link className="home-primary-link" to="/search">Check availability <span aria-hidden="true">↗</span></Link>
      </section>
      <section className="home-simple-info" aria-label="What to expect">
        <article><span className="home-info-number">01</span><h2>Choose a day</h2><p>Browse lunch and dinner availability.</p></article>
        <article><span className="home-info-number">02</span><h2>Book your table</h2><p>Sign in to confirm a reservation.</p></article>
        <article><span className="home-info-number">03</span><h2>Enjoy your visit</h2><p>We'll have a place ready for your party.</p></article>
      </section>
    </div>
  );
}
