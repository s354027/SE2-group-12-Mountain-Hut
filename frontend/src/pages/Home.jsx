
import { Link } from 'react-router-dom';

// Fictional hut for the Mountain Hut university project.
// The surrounding attractions are real, but the hut and its
// specific access route are illustrative.
const hutDetails = {
  name: 'Mountain Hut',
  location: 'Near Cogne, Valle d’Aosta, Italy',
  altitude: 'Approximately 1,850 m',
  trailhead: 'Cogne village (fictional route)',
  approach:
    'Follow our imagined alpine trail through woodland and mountain meadows. Allow approximately 1 hour 30 minutes on foot. The route and duration are fictional demo details.',
  transport:
    'Travel to Aosta, then continue towards Cogne by regional transport or car. Parking is available in the Cogne area; check local restrictions and services before travelling.',
};

const nearbyHighlights = [
  {
    number: '01',
    title: 'Gran Paradiso National Park',
    description:
      'Discover spectacular alpine landscapes, wildlife, and a network of hiking paths in one of Italy’s most celebrated national parks.',
  },
  {
    number: '02',
    title: 'Valnontey Valley',
    description:
      'Explore a peaceful valley near Cogne, known for its mountain scenery, walking paths, and views towards the Gran Paradiso massif.',
  },
  {
    number: '03',
    title: 'Lillaz Waterfalls',
    description:
      'Enjoy a visit to the beautiful waterfalls near the village of Lillaz, surrounded by forests and mountain scenery.',
  },
];

export default function Home() {
  return (
    <div className="home-page home-about-page">
      <section
        className="home-welcome home-about-intro"
        aria-labelledby="home-title"
      >
        <span className="home-welcome-eyebrow">
          WELCOME TO THE MOUNTAINS
        </span>

        <h1 id="home-title">Welcome to the Mountain Hut</h1>

        <p>
          Nestled in the beautiful Italian Alps near Cogne, Mountain Hut
          is a welcoming retreat for hikers and nature lovers. Stop for
          a warm meal, enjoy the mountain atmosphere, and discover the
          breathtaking landscapes of Valle d’Aosta.
        </p>

        <div className="home-intro-actions">
          <a className="home-secondary-link" href="#about-hut">
            Discover the hut ↓
          </a>

          <Link className="home-primary-link" to="/search">
            Check availability <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section
        className="home-about-section"
        id="about-hut"
        aria-labelledby="about-hut-title"
      >
        <div className="home-section-label">01 / THE HUT</div>

        <div className="home-about-grid">
          <div>
            <h2 id="about-hut-title">
              A place to pause along the trail.
            </h2>

            <p>
              Surrounded by alpine meadows, forests, and panoramic mountain
              views, Mountain Hut offers a peaceful place to rest during
              your adventure in the Italian Alps.
            </p>

            <p>
              Whether you are stopping for lunch after a morning hike or
              enjoying dinner in a welcoming mountain atmosphere, our
              booking system makes it easy to reserve a table and plan
              your visit.
            </p>
          </div>

          <aside
            className="home-facts-card"
            aria-label="Hut information"
          >
            <span className="home-facts-heading">
              HUT INFORMATION
            </span>

            <dl>
              <div>
                <dt>Name</dt>
                <dd>{hutDetails.name}</dd>
              </div>

              <div>
                <dt>Location</dt>
                <dd>{hutDetails.location}</dd>
              </div>

              <div>
                <dt>Elevation</dt>
                <dd>{hutDetails.altitude}</dd>
              </div>

              <div>
                <dt>Dining</dt>
                <dd>Lunch &amp; dinner booking</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section
        className="home-about-section home-journey-section"
        aria-labelledby="home-journey-title"
      >
        <div className="home-section-label">
          02 / PLAN YOUR JOURNEY
        </div>

        <h2 id="home-journey-title">
          Where to find us &amp; how to get here
        </h2>

        <p className="home-section-intro">
          Our fictional mountain refuge is set near Cogne, in the heart
          of Valle d’Aosta. The suggested hut approach is illustrative;
          always use verified maps and current trail information for
          real excursions.
        </p>

        <div className="home-journey-grid">
          <article className="home-detail-card">
            <span
              className="home-detail-symbol"
              aria-hidden="true"
            >
              ⌖
            </span>

            <h3>Location</h3>

            <p>{hutDetails.location}</p>

            <p className="home-detail-note">
              Situated in a fictional alpine setting near Gran Paradiso
              National Park, at approximately 1,850 metres.
            </p>
          </article>

          <article className="home-detail-card">
            <span
              className="home-detail-symbol"
              aria-hidden="true"
            >
              ↗
            </span>

            <h3>On foot</h3>

            <p>
              <strong>Trailhead:</strong> {hutDetails.trailhead}
            </p>

            <p className="home-detail-note">
              {hutDetails.approach}
            </p>
          </article>

          <article className="home-detail-card">
            <span
              className="home-detail-symbol"
              aria-hidden="true"
            >
              ◈
            </span>

            <h3>Transport &amp; parking</h3>

            <p>{hutDetails.transport}</p>

            <p className="home-detail-note">
              Mountain access can vary with weather and season.
            </p>
          </article>
        </div>
      </section>

      <section
        className="home-about-section"
        aria-labelledby="home-explore-title"
      >
        <div className="home-section-label">
          03 / EXPLORE THE AREA
        </div>

        <h2 id="home-explore-title">
          A little more to discover.
        </h2>

        <p className="home-section-intro">
          From beautiful valleys to waterfalls and mountain trails,
          the Cogne area offers wonderful opportunities to experience
          nature. These are real regional attractions, not verified
          walking routes from our fictional hut.
        </p>

        <div className="home-highlights-grid">
          {nearbyHighlights.map((place) => (
            <article
              className="home-highlight-card"
              key={place.number}
            >
              <span>
                {place.number} / EXPLORE THE AREA
              </span>

              <h3>{place.title}</h3>

              <p>{place.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="home-visit-cta"
        aria-labelledby="home-visit-title"
      >
        <div>
          <span className="home-section-label">
            READY FOR A BREAK?
          </span>

          <h2 id="home-visit-title">
            Your table is just a few steps away.
          </h2>

          <p>
            Choose a date, check availability, and plan your
            mountain stop.
          </p>
        </div>

        <Link className="home-primary-link" to="/search">
          Find a table <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </div>
  );
}
