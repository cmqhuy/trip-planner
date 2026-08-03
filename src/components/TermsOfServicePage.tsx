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
          <p>
            You may use the App to plan your own travel, whether personal or work-related, and to
            plan travel on behalf of others. You agree not to:
          </p>
          <ul>
            <li>Attempt to reverse engineer, decompile, or exploit the App's source code for malicious purposes</li>
            <li>Use the App to store or transmit unlawful, harmful, or abusive content</li>
            <li>Circumvent any limitations or access controls of connected third-party services
              (Google Drive, Gemini API) in violation of their respective terms</li>
            <li>Share a trip with someone in order to expose another person's personal information
              without a lawful basis for doing so</li>
          </ul>
        </Section>

        <Section title="Eligibility">
          <p>
            You must be at least 16 years old to use the App, or at least 13 where local law
            permits and you have permission from a parent or guardian. The App is not directed at
            children and does not knowingly collect information from them.
          </p>
          <p>
            Using Google Drive sync or the Gemini API also requires a Google account, which carries
            its own age requirements.
          </p>
        </Section>

        <Section title="Sharing and Collaboration">
          <p>
            The App lets you share a trip with other people using Google Drive permissions. If you
            share a trip:
          </p>
          <ul>
            <li>You are responsible for who you grant access to, and for the personal information
              contained in what you share — reservation details frequently include booking
              references, addresses, and travel dates.</li>
            <li>People granted edit access can modify or delete content in that trip. The developer
              cannot recover content changed or removed by a collaborator.</li>
            <li>Access is managed through Google Drive and can be revoked by you at any time.</li>
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
            These Terms are governed by and construed in accordance with the laws of the State of
            Washington and the federal laws of the United States, without regard to conflict of law
            provisions. You agree that the state and federal courts located in Washington shall
            have exclusive jurisdiction over any dispute arising out of or relating to these Terms
            or your use of the App.
          </p>
          <p>
            If you use the App from outside the United States, you do so on your own initiative and
            are responsible for compliance with local law. Nothing in this section removes any
            mandatory consumer-protection rights you may have under the law of your country of
            residence — where such rights apply, they take precedence over this clause.
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
