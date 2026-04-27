'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

export default function WelcomePage() {
  const { user } = useUser();
  const firstName = user?.firstName ?? null;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1320 50%, #0a0f1e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: '520px', width: '100%', textAlign: 'center' }}>

        {/* Sky orb */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '72px', height: '72px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
          marginBottom: '32px',
          boxShadow: '0 0 48px rgba(99,102,241,0.45)',
        }}>
          <span style={{ fontSize: '32px' }}>🌤️</span>
        </div>

        <h1 style={{
          fontSize: '34px', fontWeight: 800, color: '#f0f4f8',
          letterSpacing: '-0.02em', marginBottom: '16px', lineHeight: 1.2,
        }}>
          {firstName ? `You're in, ${firstName}! 🎉` : "You're in! 🎉"}
        </h1>

        <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: 1.75, marginBottom: '40px' }}>
          Thanks for signing up for SkyBridgeCX. We review every new account personally
          and will send you a setup link within{' '}
          <strong style={{ color: '#c7d2fe' }}>24 hours</strong> so we can get your
          AI front desk configured exactly right for your business.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '28px', marginBottom: '36px',
        }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '20px',
            textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
            What happens next
          </p>

          {[
            ['📧', 'Check your inbox', "We'll email you a personalized setup link"],
            ['⚡', 'Quick 2-min setup', 'Sky walks you through everything conversationally'],
            ['📞', 'Go live', 'Your AI front desk answers calls 24/7 from day one'],
          ].map(([emoji, title, desc]) => (
            <div key={title} style={{
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              marginBottom: '18px', textAlign: 'left',
            }}>
              <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>{emoji}</span>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '3px' }}>{title}</p>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '13px', color: '#475569' }}>
          Questions?{' '}
          <a href="mailto:hello@skybridgecx.com" style={{ color: '#818cf8', textDecoration: 'none' }}>
            hello@skybridgecx.com
          </a>
        </p>

        <div style={{ marginTop: '36px' }}>
          <Link href="/" style={{ fontSize: '13px', color: '#475569', textDecoration: 'none' }}>
            ← Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
