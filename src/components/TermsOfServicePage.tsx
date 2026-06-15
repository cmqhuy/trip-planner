const BASE = import.meta.env.BASE_URL;

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: '13px', marginBottom: '40px' }}>
          Effective date: June 14, 2026
        </p>

        <Section title="Acceptance of Terms">
          <p>
            By using Trip Planner (the "App"), you agree to these Terms of Service. If you
            do not agree, please discontinue use of the App. These terms may be updated at
            any time; continued use constitutes acceptance of any changes.
          </p>
        </Section>

        <Section title="Description of Service">
          <p>
            Trip Planner is a free, browser-based personal travel planning tool. It allows
            you to create and manage trip itineraries, organize places, and optionally sync
            data to your Google Drive or generate AI-assisted travel content through the
            Gemini API using your own API key.
          </p>
          <p>
            The App runs entirely in your browser. There is no paid subscription,
            user account system, or server-side data storage managed by the developer.
          </p>
        </Section>

        <Section title="Permitted Use">
          <p>You may use the App for personal, non-commercial travel planning purposes. You agree not to:</p>
          <ul>
            <li>Attempt to reverse engineer, decompile, or exploit the App's source code for malicious purposes</li>
            <li>Use the App to store or transmit unlawful, harmful, or abusive content</li>
            <li>Circumvent any limitations or access controls of connected third-party services
              (Google Drive, Gemini API) in violation of their respective terms</li>
          </ul>
        </Section>

        <Section title="Your Data and Responsibility">
          <p>
            All trip data you create belongs to you. Because the App has no backend server,
            you are solely responsible for backing up your data. The developer cannot recover
            data lost due to clearing browser storage, device failure, or any other cause.
          </p>
          <p>
            If you connect Google Drive, your trip files are stored in your own Google Drive
            account. You are responsible for managing that data in accordance with Google's
            Terms of Service.
          </p>
          <p>
            If you use Gemini AI features, you are responsible for ensuring your use of
            your Gemini API key complies with Google's Gemini API Terms of Service.
          </p>
        </Section>

        <Section title="AI-Generated Content Disclaimer">
          <p>
            Trip Planner can generate travel suggestions, place descriptions, tips, and
            itinerary content via the Gemini AI API. This content is generated automatically
            and may be inaccurate, incomplete, or outdated.
          </p>
          <p>
            AI-generated content is provided for informational purposes only. Always verify
            critical travel information (visa requirements, opening hours, safety conditions,
            transportation options, etc.) through official and authoritative sources before
            making travel decisions. The developer is not responsible for any harm arising
            from reliance on AI-generated content.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <p>
            The App integrates with third-party services including Google (Sign-In, Drive,
            Gemini), OpenStreetMap, Photon/Komoot, and Wikipedia/Wikimedia. Your use of
            those services is governed by their respective terms and privacy policies.
            The developer has no control over, and assumes no responsibility for, the
            content, policies, or practices of any third-party service.
          </p>
        </Section>

        <Section title="Disclaimer of Warranties">
          <p>
            The App is provided <strong>"as is"</strong> and <strong>"as available"</strong>
            without any warranties of any kind, express or implied, including but not limited
            to warranties of merchantability, fitness for a particular purpose, or
            non-infringement. The developer does not warrant that the App will be
            uninterrupted, error-free, or free of viruses or other harmful components.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, the developer shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages,
            including but not limited to loss of data, loss of profits, or travel disruptions,
            arising out of or related to your use of the App, even if advised of the
            possibility of such damages.
          </p>
        </Section>

        <Section title="Changes to the Service">
          <p>
            The developer reserves the right to modify, suspend, or discontinue the App at
            any time without notice. There is no obligation to maintain the App or provide
            any particular feature.
          </p>
        </Section>

        <Section title="Governing Law">
          <p>
            These Terms shall be governed by and construed in accordance with applicable law,
            without regard to conflict of law provisions.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For any questions about these Terms of Service, please contact:&nbsp;
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
