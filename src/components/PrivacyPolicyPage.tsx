const BASE = import.meta.env.BASE_URL;

export default function PrivacyPolicyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0f19',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(17, 24, 39, 0.6)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <a
          href={BASE}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#e2e8f0',
            textDecoration: 'none',
            fontSize: '13px',
            opacity: 0.7,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
        >
          ← Back to App
        </a>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
        <span style={{ fontSize: '15px', fontWeight: 600 }}>Trip Planner</span>
      </header>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', color: '#f1f5f9' }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: '13px', marginBottom: '40px' }}>
          Effective date: June 22, 2026
        </p>

        <Section title="Overview">
          <p>
            Trip Planner is a personal travel planning tool that runs entirely in your browser.
            There is no backend server operated by this application. All your trip data is stored
            locally in your browser's <code>localStorage</code> and, if you opt in, synced to
            your personal Google Drive account.
          </p>
          <p>
            This policy explains what data the app handles, how it flows through third-party
            services you choose to connect, and your rights regarding that data.
          </p>
        </Section>

        <Section title="Data Stored in Your Browser">
          <p>The following data is stored in <code>localStorage</code> in your browser only:</p>
          <ul>
            <li>Your trip itineraries (destinations, places, schedules, checklists, notes)</li>
            <li>Reservation attachment metadata (file names and base64-encoded file contents stored as part of your trip data)</li>
            <li>Gemini AI API keys you enter (stored only on your device)</li>
            <li>Google OAuth access tokens (session-only, expire automatically)</li>
            <li>App preferences and settings</li>
          </ul>
          <p>
            This data never leaves your browser unless you explicitly use a feature that
            connects to an external service (Google Drive sync or AI generation). File
            attachments are stored entirely in your browser and are only transmitted to the
            Gemini API if you choose to use the AI extraction feature on that file.
          </p>
        </Section>

        <Section title="Google Services">
          <p>
            If you sign in with Google, the app requests access to your Google Drive to store
            and sync trip files. The following applies:
          </p>
          <ul>
            <li>
              <strong>Google Sign-In:</strong> Your name, email address, and profile picture
              are retrieved from Google and stored in <code>localStorage</code> for the duration
              of your session.
            </li>
            <li>
              <strong>Google Drive:</strong> Trip data is saved as JSON files inside a
              "Trip Planner" folder in your own Drive. The app reads and writes only to
              files it creates. Your Drive credentials are not shared with any third party.
            </li>
            <li>
              Google's own privacy policy applies to data handled by their services:&nbsp;
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#818cf8' }}
              >
                policies.google.com/privacy
              </a>
            </li>
          </ul>
          <p>
            Google Drive sync is entirely optional. You can use the app fully offline without
            signing in.
          </p>
        </Section>

        <Section title="Gemini AI Integration">
          <p>
            The AI features use Google's Gemini API directly from your browser. To use them
            you must supply your own Gemini API key, which is stored only in your
            browser's <code>localStorage</code> and is never sent to any server operated by this app.
          </p>
          <p>
            When you trigger an AI generation (place details, day tips, etc.), the relevant
            trip data (place names, locations, dates) is sent directly from your browser to
            Google's Gemini API.
          </p>
          <p>
            <strong>File attachments and AI extraction:</strong> When you use the "Fill with AI"
            feature on a hotel stay or transport segment, the full binary contents of the selected
            attachment (e.g. a PDF or image of a reservation confirmation) are sent directly from
            your browser to the Gemini API for extraction. This may include personal information
            present in the document such as your name, booking reference, payment details, or
            travel dates. This transmission is initiated entirely by you; no file contents are
            stored or forwarded by this app's developer.
          </p>
          <p>
            Google's data handling policies apply to all Gemini API calls:&nbsp;
            <a
              href="https://ai.google.dev/gemini-api/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#818cf8' }}
            >
              ai.google.dev/gemini-api/terms
            </a>
          </p>
          <p>AI features are optional and only active if you provide an API key.</p>
        </Section>

        <Section title="Third-Party APIs">
          <p>
            The following external services are called automatically as part of core app
            features (no sign-in required, no personal data sent):
          </p>
          <ul>
            <li>
              <strong>OpenStreetMap Nominatim</strong> — used for geocoding (converting place
              names to coordinates). Only the search query is sent; your IP address may be
              visible per standard HTTP requests.
            </li>
            <li>
              <strong>Photon by Komoot</strong> — used for place/address search suggestions.
              Same privacy characteristics as Nominatim.
            </li>
            <li>
              <strong>Wikipedia / Wikimedia Commons</strong> — used to fetch place descriptions
              and photos. Only the place name is sent as a query.
            </li>
          </ul>
          <p>
            None of these services receive your personal information or trip itinerary data.
          </p>
        </Section>

        <Section title="Analytics and Tracking">
          <p>
            This application does not use any analytics, advertising, or tracking services.
            No cookies are set by this app (Google may set cookies as part of its OAuth flow).
            No usage data is collected or sold.
          </p>
        </Section>

        <Section title="Data Retention and Deletion">
          <p>
            Since all data is stored in your browser, you are in full control:
          </p>
          <ul>
            <li>Clear your browser's site data or <code>localStorage</code> at any time to
              remove all app data from your device.</li>
            <li>Delete the "Trip Planner" folder from your Google Drive to remove synced data
              from Google's servers.</li>
            <li>Sign out to revoke the app's Google Drive access token.</li>
          </ul>
        </Section>

        <Section title="Children's Privacy">
          <p>
            This application is not directed at children under 13 and does not knowingly
            collect personal information from children.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            This privacy policy may be updated from time to time. The effective date at the
            top of this page will reflect the most recent revision. Continued use of the app
            after changes constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For any questions or concerns about this privacy policy, please contact:&nbsp;
            <a href="mailto:cmqhuy@gmail.com" style={{ color: '#818cf8' }}>cmqhuy@gmail.com</a>
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '36px' }}>
      <h2 style={{
        fontSize: '16px',
        fontWeight: 700,
        color: '#818cf8',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: '14px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: '14px',
        lineHeight: 1.7,
        color: 'rgba(226,232,240,0.85)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {children}
      </div>
    </section>
  );
}
