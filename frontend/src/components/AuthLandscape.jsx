// Shared mountain-landscape illustration for the auth pages (Login, Register).
// `gradientId` must be unique per page so two instances rendered in the same
// document (e.g. in tests) don't clash over the same SVG gradient id.
export default function AuthLandscape({ gradientId }) {
  return (
    <div className="field-guide-landscape" aria-label="Illustrated mountain landscape">
      <svg
        className="auth-landscape-svg"
        viewBox="0 0 600 430"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d9e0d5" />
            <stop offset="48%" stopColor="#c6d2c4" />
            <stop offset="100%" stopColor="#a6b8a8" />
          </linearGradient>
        </defs>
        <rect width="600" height="430" fill={`url(#${gradientId})`} />
        <circle cx="360" cy="85" r="34" fill="#e9cda5" opacity="0.9" />
        <polygon
          points="0,260 100,140 180,220 260,90 340,210 430,120 520,200 600,150 600,430 0,430"
          fill="#829b8c"
          opacity="0.72"
        />
        <polygon
          points="0,320 90,200 170,280 260,160 350,260 440,180 520,260 600,220 600,430 0,430"
          fill="#587966"
        />
        <polygon
          points="0,380 110,290 200,350 300,260 390,340 480,280 560,340 600,320 600,430 0,430"
          fill="#355d48"
        />
        <polygon points="210,300 300,300 255,255" fill="#754f3d" />
        <rect x="220" y="300" width="70" height="55" fill="#d7c5a6" stroke="#3e5948" strokeWidth="4" />
        <rect x="235" y="330" width="16" height="25" fill="#6b806e" />
        <rect x="265" y="312" width="18" height="14" fill="#9ab1a1" stroke="#526b59" strokeWidth="2" />
      </svg>
      <div className="landscape-caption">ALPINE refuge · EST. 1,860 m</div>
      <div className="landscape-index">
        46° 03' N
        <br />
        07° 45' E
      </div>
    </div>
  );
}
