import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delete Account | Hospital Surgeons',
  description: 'Request permanent deletion of your Hospital Surgeons account and associated data.',
};

const CONTACT_EMAIL = 'medi.tap26@gmail.com';
const COMPANY_NAME = 'Hospital Surgeons';

export default function DeleteAccountPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', color: '#111', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Delete Account</h1>
      <p style={{ color: '#666', marginBottom: 32, fontSize: 14 }}>This action is permanent and cannot be undone.</p>

      <p style={{ marginBottom: 24 }}>
        You can request the permanent deletion of your <strong>{COMPANY_NAME}</strong> account and all associated
        personal data at any time by contacting us at the email address below.
      </p>

      <Section title="How to Request Deletion">
        <p>
          Send an email from your registered account email address to:{' '}
          <a href={`mailto:${CONTACT_EMAIL}?subject=Account%20Deletion%20Request&body=Hello%2C%0A%0AI%20would%20like%20to%20permanently%20delete%20my%20Hospital%20Surgeons%20account.%0A%0ARegistered%20email%3A%20%5Byour%20email%5D%0AAccount%20type%3A%20%5BDoctor%20%2F%20Hospital%5D%0A%0APlease%20proceed%20with%20the%20deletion.`} style={{ color: '#2563eb' }}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>We verify your identity by matching the sender email to your registered account.</p>
      </Section>

      <Section title="What Will Be Deleted">
        <ul>
          <li>Your profile information and account credentials</li>
          <li>All booking history and appointments</li>
          <li>Subscription details</li>
          <li>Messages and conversation history</li>
          <li>Reviews and ratings submitted</li>
          <li>Any active or pending bookings (these will be cancelled)</li>
        </ul>
      </Section>

      <Section title="Data We May Retain">
        <ul>
          <li>Medical records and patient data may be retained for up to 7 years as required by applicable healthcare regulations.</li>
          <li>Financial transaction records may be retained for tax and legal compliance purposes.</li>
          <li>Anonymized, aggregated usage statistics that cannot identify you.</li>
        </ul>
      </Section>

      <Section title="Processing Timeline">
        <ul>
          <li><strong>Within 48 hours:</strong> We verify your identity and send a confirmation email.</li>
          <li><strong>7-day grace period:</strong> You can cancel the request by replying to our confirmation email.</li>
          <li><strong>Within 30 days:</strong> Your account and all eligible data are permanently deleted.</li>
        </ul>
      </Section>

      <Section title="Contact Us">
        <p>
          For any questions about account deletion, email us at:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2563eb' }}>{CONTACT_EMAIL}</a>
        </p>
      </Section>

      <p style={{ marginTop: 48, fontSize: 13, color: '#888' }}>
        &copy; {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
        {title}
      </h2>
      <div style={{ fontSize: 15, color: '#333' }}>{children}</div>
    </div>
  );
}
