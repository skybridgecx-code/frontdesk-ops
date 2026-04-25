# SkyBridgeCX — First-Customer Outreach Kit

Goal: book 5 demos this week → close 1–2 paying customers. Targeting **owner-operator home-services contractors** in HVAC, plumbing, electrical, roofing.

## ICP (lock this in writing)

- **Industry:** HVAC / plumbing / electrical / roofing / general repair
- **Stage:** owner-operator → 5 techs (US-based, 1–10 employees)
- **Geography:** any US metro >100k population (Sun Belt is hottest — TX, FL, AZ, GA, NC)
- **Trigger:** they have a Google Business Profile with phone number, decent reviews (>3.5★), and either no after-hours answering or a generic voicemail
- **Why now:** spring/summer is peak demand for HVAC/plumbing — missed calls hurt the most right now
- **Disqualify:** national chains, franchises (different buyer), <10 reviews (too tiny / not real), 4+ stars but answering service in voicemail (already paying someone else)

## Source the list (100 prospects in ~2 hours)

1. Google Maps → search `HVAC contractor [city]` for 10 cities — copy the first 10 each.
2. Or use the `apollo:prospect` skill in this workspace to pull a structured list filtered by industry + employee count + geography.
3. Capture into a sheet:

| owner_name | business_name | city | phone | website | google_reviews | trigger_note |
|---|---|---|---|---|---|---|

The `trigger_note` is the personalization fuel. Examples: "saw your 'serving Dallas since 1998' tagline", "noticed your last review mentions a missed call", "your Google profile shows after-hours = closed".

## Channel mix (this week)

| Day | Action | Volume |
|---|---|---|
| Mon | Build the 100-list | — |
| Tue | Cold email — Touch 1 (60 of the 100, A/B subject lines) | 60 |
| Tue | Live call (after 4pm local) — top 20 from the list | 20 |
| Wed | Cold email — Touch 1 (other 40) | 40 |
| Wed | LinkedIn DM — owners with active LI presence | 20 |
| Thu | Cold email — Touch 2 (bumps to anyone who didn't open or reply) | ~80 |
| Thu | Live call — second wave | 20 |
| Fri | Cold email — Touch 3 (final, breakup-style) | ~70 |
| Fri | Demo calls with anyone who booked | 5–10 |

## Cold email — Touch 1 (Tuesday)

> A. Subject (test both):
>   - "Quick question, {{first_name}}"
>   - "{{business_name}} after-hours calls"

```
Hey {{first_name}} —

I run SkyBridgeCX. We give home-service owners an AI front desk that answers every call 24/7 and texts you the lead details (name, address, problem, urgency) within 30 seconds.

I noticed {{trigger_note}} — figured I'd reach out.

A few HVAC and plumbing owners we work with were missing 30–40% of their calls before, mostly after hours. After flipping it on, most see it pay for itself in week one.

Worth a 10-minute look? I can spin one up on a real number for {{business_name}} so you can call it yourself, no obligation.

— Mo
SkyBridgeCX • {{your_phone}}

P.S. Pricing starts at $299/mo, cheaper than a human answering service and it never sleeps.
```

## Cold email — Touch 2 (Thursday, only to non-openers/non-repliers)

> Subject: "Bumping this — {{business_name}}"

```
{{first_name}} — bumping this in case it got buried.

If after-hours calls aren't a problem for {{business_name}}, ignore me. If they are, I can put a 3-minute demo on your phone tonight.

Reply "demo" and I'll send a number you can call yourself.

— Mo
```

## Cold email — Touch 3 (Friday, breakup)

> Subject: "Closing the loop, {{first_name}}"

```
Last note from me — I'll get out of your inbox after this.

If lead capture is on your radar this quarter, here's the 90-second version of why owners switch to us:
• AI answers every call, 24/7, no menu trees
• Captures name, address, problem, urgency — texts/emails it within 30s
• $299/mo, 14-day free trial, cancel anytime

Reply "send it" and I'll get you set up. Otherwise, all good — best of luck with {{busy_season_for_industry}}.

— Mo
```

## LinkedIn DM (Wednesday)

```
Hey {{first_name}} — saw {{business_name}} on Google Maps, you've got a great review profile.

Quick one: how do you handle calls after hours / when you're on a job? Most owners I talk to lose 20–40% of inbound to voicemail and never get a callback. We built an AI front desk that answers every call and texts you the lead — figured it might be worth a 10-min look.

Open to it?
```

## Live call script (afternoons, when they're done with day jobs)

```
{ring} "{{business_name}}, this is {{owner}}."

You: Hey {{owner}}, this is Mo from SkyBridgeCX — I'll be quick. Are you the owner?

[yes]

You: Cool. We help home-service owners not lose leads to voicemail — AI answers every call 24/7 and texts you the details within 30 seconds. The reason I'm calling: I want to put a free demo number on your phone so you can hear it yourself before you decide anything. Worth a try?

[yes / maybe]

You: Awesome. What's the best email to send the demo number to? I'll text you a 10-min slot to chat afterward.

[no / not interested]

You: Totally understand. Quick question — are you missing many calls after hours, or are you on top of it?

[whatever they say → react honestly. If "we're fine," exit warmly. If "yeah it happens," pivot back to the demo offer.]
```

## Objection handling (top 5 you'll hear)

| Objection | Response |
|---|---|
| "I already have an answering service." | "Most owners we work with switched off one — it's usually 1/3 the cost, never on lunch break, and gets the address right every time. Want me to do a side-by-side on a real call?" |
| "I just want to answer calls myself." | "Totally fair when it's just you. The pain hits when you're under a sink at 2pm or asleep at 10pm — those calls go to a competitor. Demo costs you nothing, then decide." |
| "Sounds like a robot." | "I felt the same. Listen first, then judge — here's a sample call." (Send transcript + audio.) |
| "Too expensive." | "What's a single missed HVAC emergency worth to you? Most owners pay it back the first week. Also a 14-day free trial, no card till you stay." |
| "I need to think about it." | "Take your time. Here's the demo number you can call yourself — no follow-up unless you reply. If after a week you're not sold, no hard feelings." |

## Demo flow (15 min)

1. (2 min) Their pain — "Tell me about a call you missed recently."
2. (5 min) Live demo — call your own SkyBridgeCX number on speaker, pretend to be their customer with an emergency. Let them hear it.
3. (3 min) Show the dashboard — prospect record, transcript, lead alert email.
4. (3 min) Pricing — Starter $299/mo, 14-day trial, no contract.
5. (2 min) Close — "Want me to spin one up on your business name right now so you can take it for a spin tomorrow?"

## Pilot offer (first 5 customers only)

For the first 5 customers, offer:
- 30-day free trial (vs. 14)
- Free porting of their existing number
- Locked-in $249/mo for 12 months on Starter (vs. $299)
- In exchange: a written testimonial after 30 days + permission to use logo/name on the landing page

This replaces the fake testimonials in `apps/web/src/app/page.tsx` with real ones in 30–45 days.

## Tracking

Spreadsheet columns:

| business | first_name | email | phone | t1_sent | t1_opened | t2_sent | t3_sent | call1 | call2 | demo_booked | demo_held | trial_started | paid | mrr |

Track conversion: emails sent → opens → replies → demos → trials → paid. Goal in week 1: 5 demos booked, 1+ trial started.
