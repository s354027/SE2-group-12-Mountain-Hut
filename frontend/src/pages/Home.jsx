
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

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

// Signed-in homepage content per role (MH-85). Guests keep the full
// marketing page below; logged-in users get a short, role-relevant
// landing instead, pointing at the routes already available to them.
const roleHomeContent = {
  HIKER: {
    eyebrow: 'WELCOME BACK',
    title: 'Ready for your next stop at the hut?',
    description:
      'Check table availability and book your lunch or dinner at Mountain Hut.',
    primaryTo: '/search',
    primaryLabel: 'Check availability',
    cards: [
      {
        number: '01',
        title: 'Find a table',
        description: 'Search available slots by date and party size.',
      },
      {
        number: '02',
        title: 'Book your visit',
        description:
          'Reserve a table in a few steps, with any dietary requirements.',
      },
      {
        number: '03',
        title: 'Plan ahead',
        description: 'Bookings close two hours before each slot starts.',
      },
    ],
  },
  EMPLOYEE: {
    eyebrow: 'STAFF AREA',
    title: 'Manage today’s slots and tables',
    description:
      'Keep slots, tables and bookings up to date for the hut’s service.',
    primaryTo: '/staff/slots',
    primaryLabel: 'Manage slots',
    cards: [
      {
        number: '01',
        title: 'Slots',
        description: 'Open, close and review the lunch and dinner slots.',
      },
      {
        number: '02',
        title: 'Tables',
        description: 'Manage the dining tables available for each slot.',
      },
      {
        number: '03',
        title: 'Bookings',
        description:
          'Keep track of party sizes and dietary requirements for each slot.',
      },
    ],
  },
  WARDEN: {
    eyebrow: 'WARDEN AREA',
    title: 'Run the hut, from slots to staff',
    description:
      'Manage meal slots and tables, and bring new staff members on board.',
    primaryTo: '/staff/slots',
    primaryLabel: 'Manage slots',
    secondaryTo: '/admin/staff/new',
    secondaryLabel: 'Add new staff',
    cards: [
      {
        number: '01',
        title: 'Slots & tables',
        description: 'Open, close and review meal slots and seating.',
      },
      {
        number: '02',
        title: 'New staff',
        description: 'Create accounts for new employees from the admin page.',
      },
      {
        number: '03',
        title: 'Oversight',
        description: 'Keep the hut’s daily operations running smoothly.',
      },
    ],
  },
};

function SignedInHome({ role }) {
  const content = roleHomeContent[role];

  return (
    <div className="home-page home-page-simple">
      <section className="home-welcome" aria-labelledby="home-title">
        <span className="home-welcome-eyebrow">{content.eyebrow}</span>

        <h1 id="home-title">{content.title}</h1>

        <p>{content.description}</p>

        <div className="home-intro-actions">
          <Link className="home-primary-link" to={content.primaryTo}>
            {content.primaryLabel} <span aria-hidden="true">↗</span>
          </Link>

          {content.secondaryTo && (
            <Link className="home-secondary-link" to={content.secondaryTo}>
              {content.secondaryLabel} <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      </section>

      <div className="home-simple-info">
        {content.cards.map((card) => (
          <article key={card.number}>
            <span className="home-info-number">{card.number}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();

  if (user && roleHomeContent[user.role]) {
    return <SignedInHome role={user.role} />;
  }

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
