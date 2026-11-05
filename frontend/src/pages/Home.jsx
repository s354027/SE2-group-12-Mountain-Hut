import { Link } from 'react-router-dom';

// Replace the placeholders with details confirmed by your team or the hut owner.
const hutDetails = {
  name: 'Mountain Hut',
  location: 'Location to be confirmed',
  altitude: 'Altitude to be confirmed',
  trailhead: 'Starting point to be confirmed',
  approach: 'Add the recommended trail, approximate walking time, and elevation gain.',
  transport: 'Add public transport, parking, and road-access information.',
};

const nearbyHighlights = [
  {
    number: '01',
    title: 'Scenic viewpoints',
    description: 'Add a real viewpoint reachable from the hut, including its trail and walking time.',
  },
  {
    number: '02',
    title: 'Walking trails',
    description: 'Describe a verified nearby trail, its difficulty, and approximate duration.',
  },
  {
    number: '03',
    title: 'Nature & local landmarks',
    description: 'Introduce a nearby lake, mountain pass, or other confirmed point of interest.',
  },
];

export default function Home() {
  return (
    <div className="home-page home-about-page">
      <section className="home-welcome home-about-intro" aria-labelledby="home-title">
        <span className="home-welcome-eyebrow">WELCOME TO THE MOUNTAINS</span>
        <h1 id="home-title">Welcome to the Mountain Hut</h1>
        <p>A welcoming stop for hikers to rest, share a meal, and enjoy time in the mountains. Discover the hut, plan your route, and explore what is nearby.</p>
        <div className="home-intro-actions">
          <a className="home-secondary-link" href="#about-hut">Discover the hut ↓</a>
          <Link className="home-primary-link" to="/search">Check availability <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="home-about-section" id="about-hut" aria-labelledby="about-hut-title">
        <div className="home-section-label">01 / THE HUT</div>
        <div className="home-about-grid">
          <div>
            <h2 id="about-hut-title">A place to pause along the trail.</h2>
            <p>Mountain huts offer a simple, friendly place to take a break from the trail. Visitors can gather for a meal, recharge, and plan the next part of their journey.</p>
            <p>Our booking system helps guests plan lunch or dinner while helping the hut team manage seating and prepare for arrivals.</p>
          </div>
          <aside className="home-facts-card" aria-label="Hut information">
            <span className="home-facts-heading">HUT INFORMATION</span>
            <dl>
              <div><dt>Name</dt><dd>{hutDetails.name}</dd></div>
              <div><dt>Location</dt><dd>{hutDetails.location}</dd></div>
              <div><dt>Elevation</dt><dd>{hutDetails.altitude}</dd></div>
              <div><dt>Dining</dt><dd>Lunch &amp; dinner booking</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="home-about-section home-journey-section" aria-labelledby="home-journey-title">
        <div className="home-section-label">02 / PLAN YOUR JOURNEY</div>
        <h2 id="home-journey-title">Where to find us &amp; how to get here</h2>
        <p className="home-section-intro">A good mountain day starts with a clear plan. Confirm your route, access conditions, and weather before setting out.</p>
        <div className="home-journey-grid">
          <article className="home-detail-card">
            <span className="home-detail-symbol" aria-hidden="true">⌖</span>
            <h3>Location</h3>
            <p>{hutDetails.location}</p>
            <p className="home-detail-note">Add the verified address or GPS coordinates here.</p>
          </article>
          <article className="home-detail-card">
            <span className="home-detail-symbol" aria-hidden="true">↗</span>
            <h3>On foot</h3>
            <p><strong>Trailhead:</strong> {hutDetails.trailhead}</p>
            <p className="home-detail-note">{hutDetails.approach}</p>
          </article>
          <article className="home-detail-card">
            <span className="home-detail-symbol" aria-hidden="true">◈</span>
            <h3>Transport &amp; parking</h3>
            <p>{hutDetails.transport}</p>
            <p className="home-detail-note">Access can vary with season and mountain conditions.</p>
          </article>
        </div>
      </section>

      <section className="home-about-section" aria-labelledby="home-explore-title">
        <div className="home-section-label">03 / EXPLORE THE AREA</div>
        <h2 id="home-explore-title">A little more to discover.</h2>
        <p className="home-section-intro">Make your visit part of a memorable day outdoors. These are suggested categories until your team adds verified local attractions.</p>
        <div className="home-highlights-grid">
          {nearbyHighlights.map((place) => (
            <article className="home-highlight-card" key={place.number}>
              <span>{place.number} / NEAR THE HUT</span>
              <h3>{place.title}</h3>
              <p>{place.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-visit-cta" aria-labelledby="home-visit-title">
        <div>
          <span className="home-section-label">READY FOR A BREAK?</span>
          <h2 id="home-visit-title">Your table is just a few steps away.</h2>
          <p>Choose a date, check availability, and plan your mountain stop.</p>
        </div>
        <Link className="home-primary-link" to="/search">Find a table <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
