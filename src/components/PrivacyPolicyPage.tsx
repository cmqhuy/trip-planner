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
          Effective date: August 3, 2026
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
          <p>The following data is stored in <code>localStorage</code> on your device:</p>
          <ul>
            <li>Your trip itineraries (destinations, places, schedules, checklists, notes)</li>
            <li>
              Reservation attachment <strong>references</strong> — the file name and the Google
              Drive file ID. The file contents themselves are <strong>not</strong> stored in your
              browser; see "Reservation Attachments" below.
            </li>
            <li>
              Gemini AI API keys you enter. These stay on your device unless you explicitly enable
              "Sync AI settings to Drive" — see "Gemini AI Integration" below.
            </li>
            <li>
              Google OAuth access tokens, together with their expiry time. These persist across
              browser sessions and are renewed automatically while you remain signed in. They are
              removed when you sign out or clear site data.
            </li>
            <li>App preferences and settings</li>
          </ul>
          <p>
            This data stays on your device unless you use a feature that connects to an external
            service — Google Drive sync, AI generation, place search, or the map.
          </p>
          <p>
            <strong>Please note:</strong> if you do not sign in to Google Drive, your trips exist
            only in this browser. Clearing your browser's site data, using private browsing, or
            switching devices will lose them permanently. There is no other copy.
          </p>
        </Section>

        <Section title="Reservation Attachments">
          <p>
            When you attach a document (PDF, image, or other file) to a hotel stay, transport
            segment, or reservation, the file is <strong>uploaded to your own Google Drive</strong>,
            into a per-trip folder alongside your trip files. Your browser stores only a reference
            to it (the file name and the Drive file ID), not the file contents.
          </p>
          <p>
            This means attachments require Google Drive sign-in, and deleting the folder from your
            Drive removes them. If you share a trip with someone, be aware that the attachment
            folder is <strong>not</strong> shared automatically — see "Sharing Trips" below.
          </p>
          <p>
            File contents are sent to Google's Gemini API only at the moment you explicitly use the
            AI extraction feature on that file.
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
            you must supply your own Gemini API key. The key is stored in your
            browser's <code>localStorage</code> and is never sent to any server operated by this app.
          </p>
          <p>
            <strong>Optional key sync:</strong> if you turn on "Sync AI settings to Drive", your
            Gemini API keys and model preferences are written to a settings file in your own Google
            Drive so other devices can pick them up. That file is <strong>not encrypted</strong> —
            the keys are stored in readable form. Anyone with access to that Drive file can read
            them. This setting is off by default; leave it off if you would rather the keys never
            leave this device.
          </p>
          <p>
            Your key is sent to Google as part of each API request URL. Treat it as you would any
            credential: restrict it in Google AI Studio and rotate it if you suspect exposure.
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

        <Section title="Sharing Trips">
          <p>
            You can share a trip with other people by email address. Sharing is implemented using
            Google Drive's own file permissions, which means:
          </p>
          <ul>
            <li>
              The email address you enter is sent to Google and stored by Google as a permission on
              your trip file. This app does not keep its own copy or contact list.
            </li>
            <li>
              People you share with can see the entire contents of that trip, and — if you grant
              edit access — can change it. Their name and email may become visible to you and to
              other collaborators through Google Drive.
            </li>
            <li>
              Reservation attachments live in a separate Drive folder that is{' '}
              <strong>not shared automatically</strong>. Collaborators will not see attachments
              unless you share that folder yourself in Google Drive.
            </li>
            <li>
              You can review or revoke access at any time from the share dialog, or from Google
              Drive directly.
            </li>
          </ul>
          <p>
            Only share trips with people you trust, and be mindful that reservation details often
            contain personal information such as booking references and travel dates.
          </p>
        </Section>

        <Section title="Third-Party APIs">
          <p>
            The following external services are called automatically as part of core app
            features. None require sign-in. All of them necessarily receive your IP address, as
            with any web request.
          </p>
          <ul>
            <li>
              <strong>OpenStreetMap Nominatim</strong> — geocoding (converting place names to
              coordinates). Receives the search query.
            </li>
            <li>
              <strong>Photon by Komoot</strong> — place and address search suggestions. Receives
              the search query.
            </li>
            <li>
              <strong>Wikipedia / Wikimedia Commons</strong> — place descriptions and photos.
              Receives the place name.
            </li>
            <li>
              <strong>Open-Meteo</strong> — time zone lookup for transport segments. Receives the
              coordinates of the location concerned.
            </li>
            <li>
              <strong>Map tile providers</strong> (OpenStreetMap and CARTO) — used to render the
              map. These receive the coordinates and zoom level you are viewing, which reveals
              where you are planning to travel.
            </li>
            <li>
              <strong>Unsplash</strong> — fallback imagery for some places.
            </li>
          </ul>
          <p>
            These services do not receive your name, email address, notes, reservation details, or
            your itinerary as a whole. They do receive individual place names and coordinates as
            described above, and each operates under its own privacy policy.
          </p>
        </Section>

        <Section title="Analytics and Tracking">
          <p>
            This application does not use any analytics, advertising, or tracking services.
            No cookies are set by this app (Google may set cookies as part of its OAuth flow).
            No usage data is collected or sold.
          </p>
          <p>
            If this ever changes, this policy will be updated before the change ships, and the
            effective date above will reflect it.
          </p>
        </Section>

        <Section title="Data Retention and Deletion">
          <p>
            Because your data lives on your device and in your own Google Drive, you are in full
            control. There is no server-side copy for the developer to delete on your behalf.
          </p>
          <ul>
            <li>Clear your browser's site data or <code>localStorage</code> at any time to
              remove all app data from your device.</li>
            <li>Delete the app's folder from your Google Drive to remove synced trips, attachments,
              and (if you enabled key sync) the AI settings file.</li>
            <li>Sign out to discard the app's Google Drive access token on this device.</li>
            <li>Revoke the app's access entirely from your{' '}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8' }}>
                Google Account permissions page
              </a>.</li>
            <li>Deleting a trip renames its Drive file rather than removing it immediately, so
              deletions can be detected across your devices. Delete the file from Drive directly if
              you want it gone straight away.</li>
          </ul>
        </Section>

        <Section title="Your Rights">
          <p>
            Depending on where you live, you may have rights under laws such as the GDPR (Europe
            and the UK) or the CCPA (California) to access, correct, export, or delete personal
            data held about you.
          </p>
          <p>
            This app is designed so that those rights are exercised directly: it operates no
            server and holds no database of users. Your data resides on your device and in your own
            Google account, so you can access, export, and delete it yourself at any time using the
            steps above. The developer has no ability to retrieve your trip data.
          </p>
          <p>
            For the personal data that Google processes on your behalf — your account details,
            Drive files, and Gemini API requests — Google acts as the data controller, and you can
            exercise your rights through your Google account. Where any personal data is processed
            through this app, the legal basis is your consent, given by choosing to sign in or to
            enable a feature; you may withdraw it at any time by signing out or disabling that
            feature.
          </p>
          <p>
            If you have a question about your data in relation to this app, contact the address at
            the bottom of this page.
          </p>
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
