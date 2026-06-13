import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Hospital Surgeons',
  description: 'Privacy Policy for the Hospital Surgeons app.',
};

const LAST_UPDATED = 'June 13, 2025';
const CONTACT_EMAIL = 'medi.tap26@gmail.com';
const COMPANY_NAME = 'Hospital Surgeons';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', color: '#111', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: 32, fontSize: 14 }}>Last updated: {LAST_UPDATED}</p>

      <p style={{ marginBottom: 24 }}>
        At <strong>{COMPANY_NAME}</strong>, we are committed to protecting your privacy and the security of your
        personal and medical information. This Privacy Policy explains how we collect, use, and safeguard your data
        when you use our platform.
      </p>

      <Section title="1. Information We Collect">
        <ul>
          <li><strong>Account Information:</strong> Name, email address, password, and account role (doctor or hospital).</li>
          <li><strong>Professional Information (Doctors):</strong> Medical license, specialization, qualifications, and availability.</li>
          <li><strong>Hospital Information:</strong> Hospital name, registration number, address, and subscription details.</li>
          <li><strong>Patient Information:</strong> Patient names, contact details, medical records, and treatment consents collected on behalf of hospitals.</li>
          <li><strong>Booking Data:</strong> Appointment records, booking history, and payment information.</li>
          <li><strong>Usage Data:</strong> Log data, IP addresses, device information, and pages visited.</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul>
          <li>To provide and operate the Hospital Surgeons platform.</li>
          <li>To facilitate bookings between hospitals and surgeons.</li>
          <li>To process payments and manage subscriptions.</li>
          <li>To send booking confirmations, reminders, and account notifications.</li>
          <li>To detect and prevent fraud or unauthorized access.</li>
          <li>To comply with applicable legal and healthcare regulatory obligations.</li>
        </ul>
      </Section>

      <Section title="3. Sharing of Information">
        <p>We do not sell your personal information. We may share it with:</p>
        <ul>
          <li><strong>Matched Parties:</strong> Hospitals and surgeons see relevant profile and booking information to complete an assignment.</li>
          <li><strong>Service Providers:</strong> Third-party vendors for payment processing, cloud infrastructure, and email delivery — bound by confidentiality obligations.</li>
          <li><strong>Legal Authorities:</strong> When required by law or to protect the rights and safety of our users.</li>
        </ul>
      </Section>

      <Section title="4. Data Security">
        <p>
          We use industry-standard security measures including TLS/SSL encryption in transit, encrypted storage at
          rest, and role-based access controls. No method of internet transmission is 100% secure, but we strive
          to protect your data using commercially acceptable means.
        </p>
      </Section>

      <Section title="5. Data Retention">
        <p>
          We retain your data for as long as your account is active. Medical and patient records may be retained
          longer as required by healthcare regulations. When you request account deletion, your data will be deleted
          or anonymized within 30 days, except where retention is legally required.
        </p>
      </Section>

      <Section title="6. Your Rights">
        <p>You have the right to access, correct, or delete your personal data. To request account deletion, email us at:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#2563eb' }}>{CONTACT_EMAIL}</a></p>
      </Section>

      <Section title="7. Children's Privacy">
        <p>
          This platform is intended for healthcare professionals and institutions only. We do not knowingly collect
          data from individuals under 18. Contact us immediately if you believe we have done so.
        </p>
      </Section>

      <Section title="8. Changes to This Policy">
        <p>
          We may update this policy from time to time. Material changes will be communicated via email and by
          updating the date at the top of this page.
        </p>
      </Section>

      <Section title="9. Contact Us">
        <p>
          For any privacy-related questions, contact our privacy team at:{' '}
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
