const BASE = import.meta.env.BASE_URL;

export default function TermsOfServicePage() {
  return (
    <div className="tos-page">
      {/* Header */}
      <header className="tos-header">
        <a
          href={BASE}
          className="tos-back-link"
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
        >
          ← Back to App
        </a>
        <span className="tos-divider">|</span>
        <span className="tos-brand">Trip Planner</span>
      </header>

      {/* Content */}
      <div className="tos-content">
        <h1 className="tos-title">
          Terms of Service
        </h1>
        <p className="tos-date">
          Effective date: June 22, 2026
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
            The App also allows you to attach reservation documents (PDFs, images, and other
            files) to hotel stays and transport segments. You may optionally use AI to extract
            reservation details from those attachments by sending the file contents directly
            to the Gemini API from your browser.
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
            If you attach files to reservations, you are responsible for ensuring you have
            the right to share those files with third-party services (e.g. the Gemini API)
            when you choose to use the AI extraction feature. Do not attach files containing
            other people's personal or sensitive information unless you have their consent.
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
            The App can also extract reservation details (dates, names, confirmation numbers,
            etc.) from attached files using the Gemini API. Extracted data may be incorrect,
            incomplete, or misinterpreted. Always review and verify any AI-extracted
            reservation information before relying on it for travel.
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
            <a href="mailto:cmqhuy@gmail.com" className="tos-email-link">cmqhuy@gmail.com</a>
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="tos-section">
      <h2 className="tos-section-title">
        {title}
      </h2>
      <div className="tos-section-body">
        {children}
      </div>
    </section>
  );
}
