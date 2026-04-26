import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'SkyBridgeCX — AI Front Desk for Home Service Businesses',
  description:
    'Your AI front desk answers every call, captures every lead, and delivers job details before the caller hangs up.'
};

const pageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:           #F7F8FA;
    --surface:      #FFFFFF;
    --surface-2:    #F3F4F6;
    --surface-3:    #E9EBF0;
    --border:       rgba(0,0,0,0.07);
    --border-mid:   rgba(0,0,0,0.12);
    --accent:       #6366F1;
    --accent-hover: #4F46E5;
    --accent-dim:   rgba(99,102,241,0.10);
    --accent-glow:  rgba(99,102,241,0.35);
    --text-primary:   #0F1117;
    --text-secondary: #6B7280;
    --text-tertiary:  #9CA3AF;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
    --shadow-lg: 0 16px 48px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06);
    --shadow-xl: 0 32px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06);
    --font: 'Inter', system-ui, -apple-system, sans-serif;
  }

  html { scroll-behavior: smooth; }

  .lp {
    background: var(--bg);
    color: var(--text-primary);
    font-family: var(--font);
    font-size: 16px;
    line-height: 1.6;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* ── NAV ── */
  .lp-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 1000;
    height: 64px;
    padding: 0 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(247,248,250,0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    transition: box-shadow 0.3s;
  }
  .lp-nav.scrolled { box-shadow: var(--shadow-sm); }
  .lp-nav-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none;
    color: var(--text-primary);
    font-size: 16px; font-weight: 700;
    letter-spacing: -0.3px;
  }
  .lp-logo-mark {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
    color: #fff;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
  }
  .lp-nav-links { display: flex; align-items: center; gap: 32px; list-style: none; }
  .lp-nav-links a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 14px; font-weight: 500;
    transition: color 0.2s;
  }
  .lp-nav-links a:hover { color: var(--text-primary); }
  .lp-nav-actions { display: flex; align-items: center; gap: 12px; }
  .lp-btn-ghost {
    background: none; border: none;
    color: var(--text-secondary);
    font-family: var(--font); font-size: 14px; font-weight: 500;
    padding: 8px 14px; border-radius: 8px;
    cursor: pointer; text-decoration: none;
    transition: color 0.2s, background 0.2s;
  }
  .lp-btn-ghost:hover { color: var(--text-primary); background: var(--surface-2); }
  .lp-btn-primary {
    background: var(--accent); color: #fff;
    border: none; font-family: var(--font);
    font-size: 14px; font-weight: 600;
    padding: 9px 18px; border-radius: 8px;
    cursor: pointer; text-decoration: none;
    transition: all 0.2s;
  }
  .lp-btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px var(--accent-glow);
  }

  /* ── HERO ── */
  .lp-hero {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
    padding: 140px 24px 100px;
    position: relative;
    overflow: hidden;
  }
  .lp-hero-bg {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.10) 0%, transparent 70%),
      radial-gradient(ellipse 50% 40% at 85% 70%, rgba(139,92,246,0.06) 0%, transparent 60%);
    pointer-events: none;
  }
  .lp-hero-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent);
    pointer-events: none;
  }
  .lp-hero-content { position: relative; z-index: 2; max-width: 860px; }

  .lp-hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--accent-dim);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 100px;
    padding: 6px 16px;
    font-size: 12px; font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.6px; text-transform: uppercase;
    margin-bottom: 32px;
    opacity: 0; transform: translateY(16px);
    animation: lp-fade-up 0.7s ease 0.2s forwards;
  }
  .lp-badge-dot {
    width: 6px; height: 6px;
    background: var(--accent);
    border-radius: 50%;
    animation: lp-pulse 2s infinite;
  }
  @keyframes lp-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.4); }
  }

  .lp-hero h1 {
    font-size: clamp(44px, 7vw, 88px);
    font-weight: 900;
    line-height: 1.04;
    letter-spacing: -3px;
    color: var(--text-primary);
    margin-bottom: 28px;
    opacity: 0; transform: translateY(24px);
    animation: lp-fade-up 0.8s ease 0.4s forwards;
  }
  .lp-hero-accent {
    background: linear-gradient(135deg, var(--accent) 0%, #8B5CF6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .lp-hero p {
    font-size: clamp(17px, 2vw, 20px);
    color: var(--text-secondary);
    max-width: 540px; margin: 0 auto 44px;
    font-weight: 400; line-height: 1.65;
    opacity: 0; transform: translateY(24px);
    animation: lp-fade-up 0.8s ease 0.6s forwards;
  }
  .lp-hero-cta {
    display: flex; align-items: center; justify-content: center;
    gap: 14px; flex-wrap: wrap;
    opacity: 0; transform: translateY(24px);
    animation: lp-fade-up 0.8s ease 0.8s forwards;
  }
  .lp-btn-hero {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--accent); color: #fff;
    font-family: var(--font); font-size: 16px; font-weight: 700;
    padding: 16px 32px; border-radius: 14px; border: none;
    cursor: pointer; text-decoration: none;
    transition: all 0.25s; letter-spacing: -0.3px;
    box-shadow: 0 8px 24px var(--accent-glow);
  }
  .lp-btn-hero:hover {
    background: var(--accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 16px 40px rgba(99,102,241,0.45);
  }
  .lp-btn-hero-ghost {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--surface); color: var(--text-primary);
    font-family: var(--font); font-size: 16px; font-weight: 600;
    padding: 16px 32px; border-radius: 14px;
    border: 1px solid var(--border-mid);
    cursor: pointer; text-decoration: none;
    transition: all 0.25s; letter-spacing: -0.2px;
    box-shadow: var(--shadow-sm);
  }
  .lp-btn-hero-ghost:hover {
    border-color: rgba(0,0,0,0.2);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  .lp-hero-meta {
    margin-top: 28px;
    display: flex; align-items: center; justify-content: center; gap: 24px;
    flex-wrap: wrap;
    opacity: 0;
    animation: lp-fade-up 0.8s ease 1s forwards;
  }
  .lp-hero-meta span {
    font-size: 13px; color: var(--text-tertiary);
    display: flex; align-items: center; gap: 6px;
  }
  .lp-hero-meta .chk { color: #10B981; font-size: 14px; }

  @keyframes lp-fade-up {
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── LIVE WIDGET ── */
  .lp-widget-section {
    padding: 20px 24px 100px;
    display: flex; justify-content: center;
  }
  .lp-widget {
    background: var(--surface);
    border: 1px solid var(--border-mid);
    border-radius: 24px;
    width: 100%; max-width: 460px;
    overflow: hidden;
    box-shadow: var(--shadow-xl);
    opacity: 0; transform: translateY(32px);
    animation: lp-fade-up 0.9s ease 1.1s forwards, lp-float 6s ease-in-out 2.1s infinite;
  }
  @keyframes lp-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .lp-widget-header {
    background: var(--surface-2);
    padding: 16px 22px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }
  .lp-widget-brand {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; font-weight: 600; color: var(--text-primary);
  }
  .lp-widget-logo {
    width: 26px; height: 26px;
    background: linear-gradient(135deg, var(--accent) 0%, #8B5CF6 100%);
    color: #fff; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800;
  }
  .lp-live-pill {
    display: flex; align-items: center; gap: 6px;
    background: #D1FAE5;
    border: 1px solid rgba(16,185,129,0.3);
    border-radius: 100px; padding: 4px 10px;
    font-size: 11px; font-weight: 600; color: #065F46;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .lp-live-dot {
    width: 5px; height: 5px;
    background: #10B981; border-radius: 50%;
    animation: lp-pulse 1.5s infinite;
  }
  .lp-widget-body { padding: 22px; }
  .lp-caller-row {
    display: flex; align-items: center; gap: 14px;
    margin-bottom: 18px; padding-bottom: 18px;
    border-bottom: 1px solid var(--border);
  }
  .lp-caller-avatar {
    width: 42px; height: 42px;
    background: var(--accent-dim);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700; color: var(--accent);
  }
  .lp-caller-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .lp-caller-num { font-size: 12px; color: var(--text-tertiary); font-family: monospace; margin-top: 2px; }
  .lp-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .lp-field {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px; padding: 11px 13px;
  }
  .lp-field.full { grid-column: 1 / -1; }
  .lp-field-label {
    font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.8px;
    color: var(--text-tertiary); margin-bottom: 4px;
  }
  .lp-field-value { font-size: 13px; color: var(--text-primary); font-weight: 500; }
  .lp-urgency-tag {
    display: inline-flex; align-items: center; gap: 4px;
    background: #FEE2E2; border: 1px solid rgba(239,68,68,0.25);
    color: #991B1B; border-radius: 6px;
    padding: 2px 8px; font-size: 12px; font-weight: 600;
  }
  .lp-widget-footer {
    padding: 16px 22px;
    border-top: 1px solid var(--border);
    background: var(--accent-dim);
  }
  .lp-summary-label {
    font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.8px;
    color: var(--accent); margin-bottom: 5px;
  }
  .lp-summary-text { font-size: 13px; color: var(--text-secondary); line-height: 1.55; }

  /* ── STATS BAR ── */
  .lp-stats-bar { padding: 0 24px 90px; }
  .lp-stats-inner {
    max-width: 1100px; margin: 0 auto;
    display: grid; grid-template-columns: repeat(4, 1fr);
    background: var(--surface);
    border: 1px solid var(--border-mid);
    border-radius: 20px; overflow: hidden;
    box-shadow: var(--shadow-md);
  }
  .lp-stat-item {
    padding: 36px 28px; text-align: center;
    border-right: 1px solid var(--border);
    transition: background 0.25s;
  }
  .lp-stat-item:last-child { border-right: none; }
  .lp-stat-item:hover { background: var(--surface-2); }
  .lp-stat-num {
    font-size: 44px; font-weight: 900;
    color: var(--text-primary);
    letter-spacing: -2px; line-height: 1; margin-bottom: 8px;
  }
  .lp-stat-num span { color: var(--accent); }
  .lp-stat-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.45; }

  /* ── SECTIONS ── */
  .lp-section { padding: 110px 24px; }
  .lp-container { max-width: 1100px; margin: 0 auto; }
  .lp-eyebrow {
    font-size: 11px; font-weight: 700;
    letter-spacing: 1.8px; text-transform: uppercase;
    color: var(--accent); margin-bottom: 16px;
  }
  .lp-h2 {
    font-size: clamp(30px, 4vw, 52px);
    font-weight: 800; letter-spacing: -1.5px;
    color: var(--text-primary); line-height: 1.1; margin-bottom: 20px;
  }
  .lp-sub {
    font-size: 18px; color: var(--text-secondary);
    font-weight: 400; max-width: 520px; line-height: 1.65;
  }

  /* ── PAIN ── */
  .lp-pain { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .lp-pain-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; background: var(--border);
    border-radius: 20px; overflow: hidden;
    border: 1px solid var(--border-mid); margin-top: 60px;
    box-shadow: var(--shadow-md);
  }
  .lp-pain-card {
    background: var(--surface); padding: 44px 36px;
    position: relative; overflow: hidden;
    transition: background 0.25s;
  }
  .lp-pain-card:hover { background: var(--surface-2); }
  .lp-pain-num {
    position: absolute; top: 24px; right: 28px;
    font-size: 64px; font-weight: 900;
    color: rgba(99,102,241,0.06);
    letter-spacing: -4px; line-height: 1;
  }
  .lp-pain-icon {
    width: 48px; height: 48px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; margin-bottom: 22px;
    background: var(--accent-dim);
    border: 1px solid rgba(99,102,241,0.15);
  }
  .lp-pain-card h3 {
    font-size: 18px; font-weight: 700;
    color: var(--text-primary); margin-bottom: 12px; letter-spacing: -0.3px;
  }
  .lp-pain-card p { font-size: 14px; color: var(--text-secondary); line-height: 1.65; }

  /* ── HOW IT WORKS ── */
  .lp-steps {
    margin-top: 72px;
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 28px; position: relative;
  }
  .lp-steps::before {
    content: '';
    position: absolute; top: 44px;
    left: calc(16.66% + 12px); right: calc(16.66% + 12px);
    height: 1px;
    background: linear-gradient(90deg, var(--accent) 0%, rgba(139,92,246,0.3) 100%);
  }
  .lp-step { text-align: center; position: relative; }
  .lp-step-num {
    width: 88px; height: 88px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 800;
    color: var(--text-primary);
    margin: 0 auto 24px;
    background: var(--surface);
    border: 2px solid var(--border-mid);
    position: relative; z-index: 1;
    transition: all 0.3s; font-variant-numeric: tabular-nums;
    box-shadow: var(--shadow-sm);
  }
  .lp-step:hover .lp-step-num {
    background: var(--accent); color: #fff;
    border-color: var(--accent);
    box-shadow: 0 8px 28px var(--accent-glow);
  }
  .lp-step h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; letter-spacing: -0.3px; }
  .lp-step p { font-size: 14px; color: var(--text-secondary); line-height: 1.65; }

  /* ── FEATURES ── */
  .lp-features { background: var(--surface); border-top: 1px solid var(--border); }
  .lp-features-header {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 80px; align-items: end; margin-bottom: 72px;
  }
  .lp-features-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; background: var(--border);
    border-radius: 20px; overflow: hidden;
    border: 1px solid var(--border-mid);
    box-shadow: var(--shadow-md);
  }
  .lp-feature-card {
    background: var(--surface); padding: 36px 32px;
    transition: background 0.25s;
    position: relative; overflow: hidden;
  }
  .lp-feature-card:hover { background: var(--surface-2); }
  .lp-feature-card::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 2px; background: linear-gradient(90deg, var(--accent), #8B5CF6);
    transform: scaleX(0); transition: transform 0.3s;
  }
  .lp-feature-card:hover::after { transform: scaleX(1); }
  .lp-feature-icon { font-size: 26px; margin-bottom: 18px; display: block; }
  .lp-feature-card h3 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; letter-spacing: -0.2px; }
  .lp-feature-card p { font-size: 13px; color: var(--text-secondary); line-height: 1.65; }

  /* ── DEMO ── */
  .lp-demo-inner {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 72px; align-items: center;
  }
  .lp-demo-list { list-style: none; margin-top: 32px; display: flex; flex-direction: column; gap: 14px; }
  .lp-demo-list li {
    display: flex; align-items: flex-start; gap: 12px;
    font-size: 15px; color: var(--text-secondary); line-height: 1.55;
  }
  .lp-demo-check {
    width: 22px; height: 22px;
    background: var(--accent-dim);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; flex-shrink: 0; margin-top: 1px;
    color: var(--accent);
  }
  .lp-demo-visual {
    background: var(--surface);
    border: 1px solid var(--border-mid);
    border-radius: 20px; overflow: hidden;
    box-shadow: var(--shadow-xl);
  }
  .lp-demo-header {
    background: var(--surface-2); padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  }
  .lp-dots { display: flex; gap: 6px; }
  .lp-dot { width: 10px; height: 10px; border-radius: 50%; }
  .lp-dot-r { background: #FF5F57; }
  .lp-dot-y { background: #FFBD2E; }
  .lp-dot-g { background: #28CA40; }
  .lp-demo-body { padding: 22px; }
  .lp-transcript-line { display: flex; gap: 12px; margin-bottom: 14px; font-size: 13px; line-height: 1.55; }
  .lp-transcript-sp {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    white-space: nowrap; padding-top: 1px; min-width: 50px;
  }
  .lp-sp-ai { color: var(--accent); }
  .lp-sp-caller { color: var(--text-tertiary); }
  .lp-transcript-text { color: var(--text-secondary); }
  .lp-demo-sent {
    margin-top: 18px; padding: 12px 14px;
    background: var(--accent-dim);
    border: 1px solid rgba(99,102,241,0.15);
    border-radius: 10px;
  }

  /* ── TESTIMONIALS ── */
  .lp-testimonials { background: var(--surface); border-top: 1px solid var(--border); }
  .lp-testimonials-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 22px; margin-top: 60px;
  }
  .lp-testimonial {
    background: var(--bg); border: 1px solid var(--border-mid);
    border-radius: 20px; padding: 32px;
    transition: all 0.3s;
  }
  .lp-testimonial:hover {
    border-color: rgba(99,102,241,0.25);
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }
  .lp-stars { color: #F59E0B; font-size: 14px; letter-spacing: 2px; margin-bottom: 18px; }
  .lp-testimonial-quote {
    font-size: 15px; color: var(--text-primary); line-height: 1.65; margin-bottom: 22px;
  }
  .lp-testimonial-author { display: flex; align-items: center; gap: 12px; }
  .lp-author-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: var(--accent-dim);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: var(--accent); flex-shrink: 0;
  }
  .lp-author-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .lp-author-role { font-size: 12px; color: var(--text-tertiary); }

  /* ── PRICING ── */
  .lp-pricing-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 22px; margin-top: 60px; align-items: start;
  }
  .lp-pricing-card {
    background: var(--surface); border: 1px solid var(--border-mid);
    border-radius: 20px; padding: 36px 32px;
    transition: all 0.3s; position: relative;
    box-shadow: var(--shadow-sm);
  }
  .lp-pricing-card:hover:not(.featured) {
    transform: translateY(-4px); box-shadow: var(--shadow-lg);
  }
  .lp-pricing-card.featured {
    border-color: rgba(99,102,241,0.4);
    background: linear-gradient(180deg, rgba(99,102,241,0.04) 0%, var(--surface) 100%);
    box-shadow: 0 8px 40px rgba(99,102,241,0.15);
  }
  .lp-pricing-badge {
    position: absolute; top: -14px; left: 50%;
    transform: translateX(-50%);
    background: var(--accent); color: #fff;
    font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
    text-transform: uppercase; padding: 4px 14px; border-radius: 100px;
    box-shadow: 0 4px 12px var(--accent-glow);
  }
  .lp-plan-name {
    font-size: 13px; font-weight: 600; color: var(--text-tertiary);
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;
  }
  .lp-plan-price {
    font-size: 48px; font-weight: 900;
    color: var(--text-primary); letter-spacing: -2px; line-height: 1; margin-bottom: 4px;
  }
  .lp-plan-price span { font-size: 18px; font-weight: 400; color: var(--text-tertiary); }
  .lp-plan-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.55; }
  .lp-plan-divider { height: 1px; background: var(--border); margin-bottom: 24px; }
  .lp-plan-features { list-style: none; display: flex; flex-direction: column; gap: 11px; margin-bottom: 28px; }
  .lp-plan-features li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: var(--text-secondary); }
  .lp-plan-check { color: #10B981; font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .lp-btn-plan {
    width: 100%; padding: 13px; border-radius: 10px;
    font-family: var(--font); font-size: 15px; font-weight: 600;
    cursor: pointer; transition: all 0.25s; text-align: center;
    text-decoration: none; display: block; letter-spacing: -0.2px;
  }
  .lp-btn-plan-outline {
    background: transparent; border: 1px solid var(--border-mid);
    color: var(--text-primary);
  }
  .lp-btn-plan-outline:hover { border-color: var(--accent); color: var(--accent); }
  .lp-btn-plan-solid { background: var(--accent); border: none; color: #fff; }
  .lp-btn-plan-solid:hover {
    background: var(--accent-hover);
    box-shadow: 0 8px 24px var(--accent-glow);
    transform: translateY(-1px);
  }

  /* ── FAQ ── */
  .lp-faq-container { max-width: 680px; margin: 56px auto 0; }
  .lp-faq-item { border-bottom: 1px solid var(--border); overflow: hidden; }
  .lp-faq-question {
    padding: 22px 0;
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer; font-size: 16px; font-weight: 600;
    color: var(--text-primary); transition: color 0.2s; gap: 20px;
  }
  .lp-faq-question:hover { color: var(--accent); }
  .lp-faq-icon {
    width: 26px; height: 26px;
    border: 1px solid var(--border-mid); border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 16px; color: var(--accent);
    transition: all 0.3s; font-weight: 300;
  }
  .lp-faq-answer {
    max-height: 0; overflow: hidden;
    transition: max-height 0.4s ease, padding 0.3s;
    font-size: 15px; color: var(--text-secondary); line-height: 1.7;
  }
  .lp-faq-item.open .lp-faq-answer { max-height: 200px; padding-bottom: 22px; }
  .lp-faq-item.open .lp-faq-icon { transform: rotate(45deg); border-color: var(--accent); background: var(--accent-dim); }

  /* ── FINAL CTA ── */
  .lp-final-cta {
    text-align: center; padding: 130px 24px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    position: relative; overflow: hidden;
  }
  .lp-final-cta-bg {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 70% 80% at 50% 100%, rgba(99,102,241,0.07) 0%, transparent 70%);
    pointer-events: none;
  }
  .lp-final-cta h2 {
    font-size: clamp(32px, 5vw, 64px); font-weight: 900;
    letter-spacing: -2px; color: var(--text-primary); margin-bottom: 20px; position: relative;
  }
  .lp-final-cta p { font-size: 18px; color: var(--text-secondary); margin-bottom: 44px; position: relative; }

  /* ── FOOTER ── */
  .lp-footer {
    background: var(--text-primary);
    border-top: 1px solid rgba(255,255,255,0.08);
    padding: 56px 24px 40px;
  }
  .lp-footer-inner {
    max-width: 1100px; margin: 0 auto;
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 56px;
  }
  .lp-footer-brand-name {
    display: flex; align-items: center; gap: 10px;
    color: #fff; font-size: 15px; font-weight: 700;
    letter-spacing: -0.3px; text-decoration: none; margin-bottom: 14px;
  }
  .lp-footer-brand-mark {
    width: 30px; height: 30px;
    background: linear-gradient(135deg, var(--accent) 0%, #8B5CF6 100%);
    color: #fff; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800;
  }
  .lp-footer-desc { font-size: 14px; color: rgba(255,255,255,0.45); line-height: 1.65; max-width: 240px; }
  .lp-footer-col h4 {
    font-size: 12px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 1px; color: rgba(255,255,255,0.4); margin-bottom: 16px;
  }
  .lp-footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .lp-footer-col a {
    font-size: 14px; color: rgba(255,255,255,0.55);
    text-decoration: none; transition: color 0.2s;
  }
  .lp-footer-col a:hover { color: rgba(255,255,255,0.9); }
  .lp-footer-bottom {
    max-width: 1100px; margin: 36px auto 0;
    padding-top: 22px; border-top: 1px solid rgba(255,255,255,0.08);
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px; color: rgba(255,255,255,0.35);
  }

  /* ── REVEAL ── */
  .reveal {
    opacity: 0; transform: translateY(32px);
    transition: all 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .reveal.visible { opacity: 1; transform: translateY(0); }

  /* ── RESPONSIVE ── */
  @media (max-width: 1024px) {
    .lp-features-header { grid-template-columns: 1fr; gap: 20px; }
    .lp-demo-inner { grid-template-columns: 1fr; gap: 48px; }
    .lp-stats-inner { grid-template-columns: repeat(2, 1fr); }
    .lp-footer-inner { grid-template-columns: 1fr 1fr; gap: 36px; }
  }
  @media (max-width: 768px) {
    .lp-nav { padding: 0 20px; }
    .lp-nav-links { display: none; }
    .lp-pain-grid, .lp-features-grid, .lp-testimonials-grid, .lp-pricing-grid, .lp-steps { grid-template-columns: 1fr; }
    .lp-steps::before { display: none; }
    .lp-stats-inner { grid-template-columns: 1fr; }
    .lp-section { padding: 80px 20px; }
    .lp-footer-inner { grid-template-columns: 1fr; gap: 28px; }
    .lp-footer-bottom { flex-direction: column; gap: 10px; text-align: center; }
  }
`;

const pageMarkup = `
<!-- NAV -->
<nav class="lp-nav" id="lp-nav">
  <a href="/" class="lp-nav-logo">
    <div class="lp-logo-mark">SX</div>
    SkyBridgeCX
  </a>
  <ul class="lp-nav-links">
    <li><a href="#features">Features</a></li>
    <li><a href="#how-it-works">How It Works</a></li>
    <li><a href="#pricing">Pricing</a></li>
    <li><a href="#faq">FAQ</a></li>
  </ul>
  <div class="lp-nav-actions">
    <a href="/sign-in" class="lp-btn-ghost">Sign In</a>
    <a href="/sign-up" class="lp-btn-primary">Get Started</a>
  </div>
</nav>

<!-- HERO -->
<section class="lp-hero" id="home">
  <div class="lp-hero-bg"></div>
  <div class="lp-hero-grid"></div>
  <div class="lp-hero-content">
    <div class="lp-hero-badge">
      <div class="lp-badge-dot"></div>
      AI-Powered · 24/7 · Instant Alerts
    </div>
    <h1>Never Miss<br>Another <span class="lp-hero-accent">Call.</span></h1>
    <p>Your AI front desk answers every call, captures every lead, and delivers the details before the caller even hangs up.</p>
    <div class="lp-hero-cta">
      <a href="/sign-up" class="lp-btn-hero">Start Free Trial →</a>
      <a href="#how-it-works" class="lp-btn-hero-ghost">▶ See How It Works</a>
    </div>
    <div class="lp-hero-meta">
      <span><span class="chk">✓</span> Setup in 5 minutes</span>
      <span><span class="chk">✓</span> No contracts</span>
      <span><span class="chk">✓</span> Cancel anytime</span>
    </div>
  </div>
</section>

<!-- LIVE WIDGET -->
<div class="lp-widget-section">
  <div class="lp-widget">
    <div class="lp-widget-header">
      <div class="lp-widget-brand">
        <div class="lp-widget-logo">SX</div>
        SkyBridgeCX AI Front Desk
      </div>
      <div class="lp-live-pill"><div class="lp-live-dot"></div>Live</div>
    </div>
    <div class="lp-widget-body">
      <div class="lp-caller-row">
        <div class="lp-caller-avatar">A</div>
        <div>
          <div class="lp-caller-name">Angela M.</div>
          <div class="lp-caller-num">(214) 555-0142</div>
        </div>
      </div>
      <div class="lp-field-grid">
        <div class="lp-field"><div class="lp-field-label">Intent</div><div class="lp-field-value">A/C not cooling</div></div>
        <div class="lp-field"><div class="lp-field-label">Urgency</div><div class="lp-field-value"><span class="lp-urgency-tag">🔴 Emergency</span></div></div>
        <div class="lp-field full"><div class="lp-field-label">Service Address</div><div class="lp-field-value">4821 Preston Hollow Dr, Dallas TX</div></div>
      </div>
    </div>
    <div class="lp-widget-footer">
      <div class="lp-summary-label">AI Summary</div>
      <div class="lp-summary-text">Customer reports no cold air and rising indoor temperature. Requested same-day technician dispatch.</div>
    </div>
  </div>
</div>

<!-- STATS -->
<div class="lp-stats-bar">
  <div class="lp-stats-inner">
    <div class="lp-stat-item reveal"><div class="lp-stat-num">40<span>%</span></div><div class="lp-stat-desc">of service calls come<br>outside business hours</div></div>
    <div class="lp-stat-item reveal"><div class="lp-stat-num"><span>$</span>800</div><div class="lp-stat-desc">avg monthly cost of<br>human answering services</div></div>
    <div class="lp-stat-item reveal"><div class="lp-stat-num">30<span>s</span></div><div class="lp-stat-desc">to receive lead details<br>in your inbox</div></div>
    <div class="lp-stat-item reveal"><div class="lp-stat-num">24<span>/7</span></div><div class="lp-stat-desc">AI availability — never<br>sleeps, never misses</div></div>
  </div>
</div>

<!-- PAIN POINTS -->
<section class="lp-section lp-pain" id="pain">
  <div class="lp-container">
    <div class="lp-eyebrow reveal">The Problem</div>
    <h2 class="lp-h2 reveal">Every Missed Call Is<br>a Lost Job</h2>
    <p class="lp-sub reveal">Home service demand is high, but silent phones and messy intake quietly drain your revenue every single day.</p>
    <div class="lp-pain-grid">
      <div class="lp-pain-card reveal"><div class="lp-pain-num">01</div><div class="lp-pain-icon">🌙</div><h3>Missed Calls After Hours</h3><p>40% of service calls come when you're off the clock. Every voicemail is a potential job walking to your competitor.</p></div>
      <div class="lp-pain-card reveal"><div class="lp-pain-num">02</div><div class="lp-pain-icon">💸</div><h3>Expensive Answering Services</h3><p>Human services cost $400–$1,000/month, often miss critical details, and still can't match real AI comprehension.</p></div>
      <div class="lp-pain-card reveal"><div class="lp-pain-num">03</div><div class="lp-pain-icon">📋</div><h3>No Lead Tracking System</h3><p>Sticky notes and voicemails don't scale. You lose context, miss follow-ups, and can't measure what's actually closing.</p></div>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="lp-section" id="how-it-works">
  <div class="lp-container">
    <div class="lp-eyebrow reveal">How It Works</div>
    <h2 class="lp-h2 reveal">3 Steps to Never<br>Miss a Lead</h2>
    <div class="lp-steps">
      <div class="lp-step reveal"><div class="lp-step-num">01</div><h3>Connect Your Number</h3><p>Pick a local number or port your existing one. Full setup in under 5 minutes — no tech skills required.</p></div>
      <div class="lp-step reveal"><div class="lp-step-num">02</div><h3>AI Answers Every Call</h3><p>Your AI agent greets callers naturally, understands their needs, extracts every critical detail — no menus, no robots.</p></div>
      <div class="lp-step reveal"><div class="lp-step-num">03</div><h3>Instant Lead Alerts</h3><p>Name, phone, address, urgency, and a full job summary hit your inbox in 30 seconds. Act before the caller calls anyone else.</p></div>
    </div>
  </div>
</section>

<!-- DEMO TRANSCRIPT -->
<section class="lp-section" style="background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">
  <div class="lp-container">
    <div class="lp-demo-inner">
      <div class="reveal">
        <div class="lp-eyebrow">Live Call Demo</div>
        <h2 class="lp-h2">Sounds Human.<br>Thinks Machine.</h2>
        <p class="lp-sub">Your AI agent doesn't read from a script — it listens, understands, and responds like a trained dispatcher.</p>
        <ul class="lp-demo-list">
          <li><div class="lp-demo-check">✓</div> Natural conversation flow, not robotic IVR menus</li>
          <li><div class="lp-demo-check">✓</div> Understands industry-specific language (HVAC, plumbing, electrical)</li>
          <li><div class="lp-demo-check">✓</div> Detects urgency in tone and words automatically</li>
          <li><div class="lp-demo-check">✓</div> Captures all lead fields without asking twice</li>
          <li><div class="lp-demo-check">✓</div> Custom personality and greeting per business</li>
        </ul>
      </div>
      <div class="lp-demo-visual reveal">
        <div class="lp-demo-header">
          <div class="lp-dots"><div class="lp-dot lp-dot-r"></div><div class="lp-dot lp-dot-y"></div><div class="lp-dot lp-dot-g"></div></div>
          <span style="font-size:12px; color: var(--text-tertiary); margin-left: 10px;">Live Transcript — Call #2847</span>
        </div>
        <div class="lp-demo-body">
          <div class="lp-transcript-line"><div class="lp-transcript-sp lp-sp-ai">AI</div><div class="lp-transcript-text">Thank you for calling Reliable HVAC. This is Sky — how can I help you today?</div></div>
          <div class="lp-transcript-line"><div class="lp-transcript-sp lp-sp-caller">Caller</div><div class="lp-transcript-text">Yeah my A/C just stopped working. It's 95 degrees in here, I have kids at home.</div></div>
          <div class="lp-transcript-line"><div class="lp-transcript-sp lp-sp-ai">AI</div><div class="lp-transcript-text">I'm so sorry to hear that — that sounds urgent. Let me get this flagged for your team right away. Can I get your name and address?</div></div>
          <div class="lp-transcript-line"><div class="lp-transcript-sp lp-sp-caller">Caller</div><div class="lp-transcript-text">Angela Martinez, 4821 Preston Hollow Drive in Dallas.</div></div>
          <div class="lp-transcript-line"><div class="lp-transcript-sp lp-sp-ai">AI</div><div class="lp-transcript-text">Got it, Angela. I'm flagging this as a same-day emergency and sending your team the full details now. You'll hear back within 20 minutes.</div></div>
          <div class="lp-demo-sent">
            <div style="font-size:11px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px;">📨 Alert sent in 28 seconds</div>
            <div style="font-size:12px; color: var(--text-secondary);">Lead captured · Emergency flagged · Owner notified</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section class="lp-section lp-features" id="features">
  <div class="lp-container">
    <div class="lp-features-header">
      <div>
        <div class="lp-eyebrow reveal">Features</div>
        <h2 class="lp-h2 reveal">Everything You Need<br>to Close Every Lead</h2>
      </div>
      <p class="lp-sub reveal">A complete AI front desk system — not just a call answering bot. Built specifically for home service businesses.</p>
    </div>
    <div class="lp-features-grid">
      <div class="lp-feature-card reveal"><span class="lp-feature-icon">📞</span><h3>24/7 AI Call Answering</h3><p>Never miss a call, even at 2am on a holiday. Your AI answers every ring with a professional, human-sounding voice.</p></div>
      <div class="lp-feature-card reveal"><span class="lp-feature-icon">⚡</span><h3>Instant Lead Extraction</h3><p>Name, phone, address, intent, and urgency captured and structured automatically from every conversation.</p></div>
      <div class="lp-feature-card reveal"><span class="lp-feature-icon">📬</span><h3>Email Alerts in 30 Seconds</h3><p>Full lead details hit your inbox before the caller hangs up. Act first, win more jobs.</p></div>
      <div class="lp-feature-card reveal"><span class="lp-feature-icon">🎙️</span><h3>Call Recording & Playback</h3><p>Listen back to every conversation from your dashboard. Full audit trail for training, disputes, and QA.</p></div>
      <div class="lp-feature-card reveal"><span class="lp-feature-icon">📊</span><h3>Prospect CRM</h3><p>Track every lead from first call to closed job. Pipeline view, disposition tags, and follow-up reminders built in.</p></div>
      <div class="lp-feature-card reveal"><span class="lp-feature-icon">✍️</span><h3>AI Outreach Copilot</h3><p>Generates personalized follow-up emails and call scripts for each lead automatically. Less writing, more closing.</p></div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="lp-section lp-testimonials">
  <div class="lp-container">
    <div class="lp-eyebrow reveal" style="text-align:center;">What Customers Say</div>
    <h2 class="lp-h2 reveal" style="text-align:center;">Trusted by Home Service<br>Businesses Nationwide</h2>
    <div class="lp-testimonials-grid">
      <div class="lp-testimonial reveal"><div class="lp-stars">★★★★★</div><p class="lp-testimonial-quote">"We were missing 30% of our after-hours calls. SkyBridgeCX catches every single one now. ROI was immediate — paid for itself in week one."</p><div class="lp-testimonial-author"><div class="lp-author-avatar">M</div><div><div class="lp-author-name">Mike R.</div><div class="lp-author-role">Owner, Reliable HVAC · Dallas, TX</div></div></div></div>
      <div class="lp-testimonial reveal"><div class="lp-stars">★★★★★</div><p class="lp-testimonial-quote">"Replaced our $800/month answering service. The AI captures better details, never gets the address wrong, and costs a fraction of the price."</p><div class="lp-testimonial-author"><div class="lp-author-avatar">S</div><div><div class="lp-author-name">Sarah T.</div><div class="lp-author-role">Owner, Apex Plumbing · Phoenix, AZ</div></div></div></div>
      <div class="lp-testimonial reveal"><div class="lp-stars">★★★★★</div><p class="lp-testimonial-quote">"I get a text with the lead details before I even put my tools down. It's like having a dispatcher who never takes a break and never makes a mistake."</p><div class="lp-testimonial-author"><div class="lp-author-avatar">J</div><div><div class="lp-author-name">James K.</div><div class="lp-author-role">Owner, Precision Electric · Austin, TX</div></div></div></div>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="lp-section" id="pricing" style="background: var(--surface); border-top: 1px solid var(--border);">
  <div class="lp-container">
    <div class="lp-eyebrow reveal" style="text-align:center;">Pricing</div>
    <h2 class="lp-h2 reveal" style="text-align:center;">Simple Pricing.<br>No Hidden Fees.</h2>
    <p class="lp-sub reveal" style="text-align:center; margin: 0 auto;">14-day free trial on all plans. Cancel anytime.</p>
    <div class="lp-pricing-grid">
      <div class="lp-pricing-card reveal"><div class="lp-plan-name">Starter</div><div class="lp-plan-price">$299<span>/mo</span></div><div class="lp-plan-desc">Perfect for solo operators and small teams getting started.</div><div class="lp-plan-divider"></div><ul class="lp-plan-features"><li><span class="lp-plan-check">✓</span> 500 calls/month</li><li><span class="lp-plan-check">✓</span> 1 phone number</li><li><span class="lp-plan-check">✓</span> AI call answering 24/7</li><li><span class="lp-plan-check">✓</span> Lead extraction & email alerts</li><li><span class="lp-plan-check">✓</span> Call recording & playback</li><li><span class="lp-plan-check">✓</span> Basic dashboard & CRM</li></ul><a href="/sign-up" class="lp-btn-plan lp-btn-plan-outline">Start Free Trial</a></div>
      <div class="lp-pricing-card featured reveal"><div class="lp-pricing-badge">Most Popular</div><div class="lp-plan-name">Pro</div><div class="lp-plan-price">$499<span>/mo</span></div><div class="lp-plan-desc">For growing businesses ready to systemize lead capture completely.</div><div class="lp-plan-divider"></div><ul class="lp-plan-features"><li><span class="lp-plan-check">✓</span> Unlimited calls</li><li><span class="lp-plan-check">✓</span> Up to 3 phone numbers</li><li><span class="lp-plan-check">✓</span> Everything in Starter</li><li><span class="lp-plan-check">✓</span> AI Outreach Copilot</li><li><span class="lp-plan-check">✓</span> Custom agent personality</li><li><span class="lp-plan-check">✓</span> Priority support</li></ul><a href="/sign-up" class="lp-btn-plan lp-btn-plan-solid">Start Free Trial</a></div>
      <div class="lp-pricing-card reveal"><div class="lp-plan-name">Enterprise</div><div class="lp-plan-price">$999<span>/mo</span></div><div class="lp-plan-desc">For multi-location businesses and franchise operators at scale.</div><div class="lp-plan-divider"></div><ul class="lp-plan-features"><li><span class="lp-plan-check">✓</span> Unlimited calls</li><li><span class="lp-plan-check">✓</span> Up to 10 phone numbers</li><li><span class="lp-plan-check">✓</span> Up to 5 locations</li><li><span class="lp-plan-check">✓</span> Everything in Pro</li><li><span class="lp-plan-check">✓</span> API access & webhooks</li><li><span class="lp-plan-check">✓</span> Dedicated onboarding manager</li></ul><a href="mailto:hello@skybridgecx.com" class="lp-btn-plan lp-btn-plan-outline">Contact Sales</a></div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section class="lp-section" id="faq">
  <div class="lp-container">
    <div class="lp-eyebrow reveal" style="text-align:center;">FAQ</div>
    <h2 class="lp-h2 reveal" style="text-align:center;">Common Questions</h2>
    <div class="lp-faq-container">
      <div class="lp-faq-item"><div class="lp-faq-question" onclick="lpToggleFaq(this)">How does the AI answer calls?<div class="lp-faq-icon">+</div></div><div class="lp-faq-answer">SkyBridgeCX uses a conversational AI agent trained on home service call flows. It greets callers naturally, handles their inquiry, and extracts all relevant lead data — no robotic menu trees or hold music.</div></div>
      <div class="lp-faq-item"><div class="lp-faq-question" onclick="lpToggleFaq(this)">Can I keep my existing phone number?<div class="lp-faq-icon">+</div></div><div class="lp-faq-answer">Yes. You can port your existing business number to SkyBridgeCX or use a new local number. Porting takes 3–7 business days and we handle the process for you.</div></div>
      <div class="lp-faq-item"><div class="lp-faq-question" onclick="lpToggleFaq(this)">What if the AI can't handle a call?<div class="lp-faq-icon">+</div></div><div class="lp-faq-answer">The AI handles 95%+ of standard intake calls. For complex or escalated situations, you configure overflow rules — calls can be transferred, or the AI captures what it can and flags it for follow-up.</div></div>
      <div class="lp-faq-item"><div class="lp-faq-question" onclick="lpToggleFaq(this)">How fast do I get lead notifications?<div class="lp-faq-icon">+</div></div><div class="lp-faq-answer">Lead details are delivered to your email within 30 seconds of the call ending. Emergency-flagged leads trigger instant notification regardless of time of day.</div></div>
      <div class="lp-faq-item"><div class="lp-faq-question" onclick="lpToggleFaq(this)">Can I customize the AI's greeting?<div class="lp-faq-icon">+</div></div><div class="lp-faq-answer">Yes, on Pro and Enterprise plans. You can customize the agent's name, greeting script, tone, and the business information it references during calls.</div></div>
      <div class="lp-faq-item"><div class="lp-faq-question" onclick="lpToggleFaq(this)">Is there a long-term contract?<div class="lp-faq-icon">+</div></div><div class="lp-faq-answer">No contracts. All plans are month-to-month. You can cancel anytime from your dashboard. We're confident you'll stay because it works.</div></div>
    </div>
  </div>
</section>

<!-- FINAL CTA -->
<section class="lp-final-cta">
  <div class="lp-final-cta-bg"></div>
  <h2 class="reveal">Stop Losing Leads.<br>Start Closing More Jobs.</h2>
  <p class="reveal">Join home service businesses using SkyBridgeCX to capture every call, every lead, every time.</p>
  <a href="/sign-up" class="lp-btn-hero reveal">Start Your Free Trial →</a>
  <div style="margin-top: 18px; font-size: 13px; color: var(--text-tertiary); position: relative;" class="reveal">14-day free trial · No contract · Setup in 5 minutes</div>
</section>

<!-- FOOTER -->
<footer class="lp-footer">
  <div class="lp-footer-inner">
    <div>
      <div class="lp-footer-brand-name"><div class="lp-footer-brand-mark">SX</div>SkyBridgeCX</div>
      <p class="lp-footer-desc">AI front desk for home service businesses. Never miss a call, never lose a lead.</p>
    </div>
    <div class="lp-footer-col"><h4>Product</h4><ul><li><a href="#features">Features</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#faq">FAQ</a></li><li><a href="/dashboard">Dashboard</a></li></ul></div>
    <div class="lp-footer-col"><h4>Company</h4><ul><li><a href="/">About</a></li><li><a href="/">Blog</a></li><li><a href="/privacy">Privacy Policy</a></li><li><a href="/terms">Terms of Service</a></li></ul></div>
    <div class="lp-footer-col"><h4>Contact</h4><ul><li><a href="mailto:hello@skybridgecx.com">hello@skybridgecx.com</a></li><li><a href="/">Twitter / X</a></li><li><a href="/">LinkedIn</a></li><li><a href="/">Support</a></li></ul></div>
  </div>
  <div class="lp-footer-bottom">
    <span>© 2025 SkyBridgeCX. All rights reserved.</span>
    <span style="font-size:11px;">Powered by AI · Built for the trades</span>
  </div>
</footer>
`;

const pageScript = `(() => {
  // Nav scroll shadow
  window.addEventListener('scroll', () => {
    document.getElementById('lp-nav').classList.toggle('scrolled', window.scrollY > 40);
  });

  // Scroll reveal
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // FAQ
  window.lpToggleFaq = function(el) {
    const item = el.parentElement;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.lp-faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  };
})();`;

export default function Home() {
  return (
    <main className="lp">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
      <div dangerouslySetInnerHTML={{ __html: pageMarkup }} />
      <Script id="lp-interactions" strategy="afterInteractive">
        {pageScript}
      </Script>
    </main>
  );
}
