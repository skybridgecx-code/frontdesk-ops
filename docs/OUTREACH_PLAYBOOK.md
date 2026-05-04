# SkyBridgeCX — Expert Outreach Playbook

**Author:** Mo (founder)
**Audience:** Mo, any teammate, and the `skybridge-outreach` agent.
**Last refreshed:** 2026-04-27

This is the source of truth for how SkyBridgeCX wins home-services SMBs. It encodes the moves a senior SDR + AE team would make and is the document the outreach agent reads on every run. **Update this in PRs, not in chat.**

---

## 1. Strategy in one paragraph

We sell to owner-operator home-services SMBs (HVAC / plumbing / electrical / roofing) in US Sun Belt metros. Their pain is binary and obvious: **inbound calls are revenue, missed calls are lost jobs**. They feel it most April–September. We don't sell "AI"; we sell *missed-call recovery* and *24/7 capture* at a flat price under what a human answering service costs. The shortest path to revenue is **owner-direct outreach** — multi-channel, multi-touch, with a callable demo line as the asymmetric weapon.

---

## 2. ICP — who we go after (and who we don't)

**Hard ICP filters (must hit all four):**

1. Vertical: HVAC, plumbing, electrical, roofing, garage doors, water-damage restoration, or general handyman.
2. Stage: 1–10 employees / 1–5 trucks. Owner answers the phone or has one office manager.
3. Geography: US metro, population > 100k, in a high-demand state (TX, FL, AZ, GA, NC, SC, NV, CA-Inland, CO).
4. Trigger:
   - Google Business Profile shows after-hours = closed, OR
   - Last 5 reviews mention "didn't call back / hard to reach / left voicemail," OR
   - They run a generic carrier voicemail (no greeting, no SMS auto-reply), OR
   - They are in spring/summer peak demand right now.

**Bonus ICP signals (rank higher):**

- Bilingual market (high Spanish-speaker share) → bilingual agent is a hard-differentiator
- 3.5–4.7★ Google rating with > 30 reviews (real business, not too entrenched)
- Active Facebook/IG with photos of crew + trucks (cares about brand)
- Lists a phone number prominently above-the-fold on their site (phone is the primary inbound)

**Disqualify (do not pursue):**

- National chains and franchises (Mr. Rooter, Roto-Rooter corp, ARS-Rescue Rooter, etc.) — different buyer
- < 10 reviews on Google → too small or not real
- Already paying a 24/7 human service that picks up on the demo call (heavy switching cost; revisit in 90 days)
- Dental / medical / legal — different vertical, HIPAA-adjacent
- Companies whose owner is unreachable through any channel (no LI, no email, no DM) after 60 minutes of research

**ICP sanity check:** if you can't picture the owner driving a truck and answering their cell on a Saturday, they're not our ICP.

---

## 3. Source the list (100 prospects in 90 minutes)

Channels in order of yield:

1. **Apollo Prospector** (`apollo:prospect` skill) — filter: `industry IN (HVAC, Plumbing, Electrical, Roofing) AND employee_count BETWEEN 1 AND 25 AND headquarters_country = US AND headquarters_state IN (TX, FL, AZ, GA, NC)`. Pull 200, filter manually to 100.
2. **Google Maps scrape** — for each target city, search `[vertical] contractor [city]`, take rows 1–20. Faster signal: clicking through a Google profile already shows phone, after-hours status, and recent reviews.
3. **Common Room** (`common-room:prospect`) — only if Common Room has been bootstrapped with home-services signals. Use for warm-fan-of-X-tool plays later.
4. **Manual mining (last-resort filler):** Yelp, BBB, Angi top 10 in each metro.

**Capture schema (CSV → CRM):**

| owner_name | business_name | city | state | phone | website | google_rating | review_count | trigger_note | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

`trigger_note` is the personalization fuel. Examples:
- "your last 3 reviews mention being hard to reach after hours"
- "Google profile shows closed at 5pm — you're losing summer A/C calls after dinner"
- "saw your truck wrap on the south Dallas tag"
- "your bio says you've been running [Business] since 2003"

**Quality gate before sending:** every row needs (a) a real owner first name, (b) at least one trigger that's specific to *that* business — not generic. If you can't write a personal line, drop the row.

---

## 4. Channel mix and cadence

The cadence is 14 calendar days from first touch to breakup. Channels stack — the goal is the prospect sees us across 3–4 surfaces in 10 days, not the same email 3 times.

| Day | Channel | Touch | Volume cap |
| --- | --- | --- | --- |
| 0   | Cold email | T1 — value + trigger | 60/day |
| 1   | Live call (after 4pm local) | "Hey, sent you a note yesterday — got 30 sec?" | 20/day |
| 2   | LinkedIn DM | Warmer reframe of T1 | 20/day |
| 4   | Cold email | T2 — bump (only non-openers/non-repliers) | 80/day |
| 6   | SMS (only if owner cell is publicly listed and outbound consent is plausible — see compliance) | One-line | 20/day |
| 7   | Live call | Persistent + voicemail with the demo number | 20/day |
| 10  | Cold email | T3 — breakup with the demo number front and center | 70/day |
| 14  | Add to nurture | Quarterly check-in | — |

Hard rule: stop the moment they reply or click the demo number. Move them to the demo flow; the cadence is for cold prospects only.

---

## 5. Copy library

### 5.1 Cold email — Touch 1

Subject options (A/B every 50 sends, keep the winner per metro):

- "Quick question, {{first_name}}"
- "{{business_name}} after-hours calls"
- "Saw your {{vertical}} biz in {{city}}"

Body:

```
Hey {{first_name}} —

Mo here at SkyBridgeCX. We give home-service owners an AI front desk
that picks up every call 24/7 and texts you the lead — caller name,
service address, problem, urgency — within 30 seconds.

I noticed {{trigger_note}} — figured I'd reach out.

Most owners we work with were missing 30–40% of their calls before,
mostly after hours. After flipping it on, most see it pay for itself
in week one.

Want to hear it? Call our demo line at {{demo_phone}} and pretend to
be your own customer. If it doesn't handle the call better than your
current setup, walk away — no pitch.

— Mo
SkyBridgeCX • {{your_phone}}
P.S. $299/mo Starter, $499/mo Pro. No contracts. 14-day free trial.
```

**Why this works:** the demo phone number is a no-friction asymmetric CTA — they can hear the product without booking, talking to a salesperson, or filling a form. Mid-week opens are 40% higher when the CTA is "call this number" vs "click here."

### 5.2 Cold email — Touch 2 (bump)

Subject: `Bumping this — {{business_name}}`

```
{{first_name}} — bumping this in case it got buried.

If after-hours calls aren't a problem for {{business_name}}, ignore me.
If they are, call {{demo_phone}} and hear the AI answer for yourself.

Reply "demo" and I'll set up a number on your line tonight.

— Mo
```

### 5.3 Cold email — Touch 3 (breakup)

Subject: `Closing the loop, {{first_name}}`

```
Last note from me — out of your inbox after this.

If lead capture is on your radar this quarter, the 90-second version:
• AI answers every call 24/7, in English and Spanish
• Captures name, address, problem, urgency — texts in 30s
• $299/mo flat. 14-day free trial. Cancel anytime.
• Recording disclosure on every call (TCPA-clean out of the box)

Demo line: {{demo_phone}}. Call it.

Otherwise, all good. Best of luck heading into {{busy_season}}.

— Mo
```

### 5.4 LinkedIn DM (Day 2)

```
Hey {{first_name}} — saw {{business_name}} on Google Maps, you've got a
solid review profile.

Quick one: how do you handle inbound when you're on a job or after hours?
Most owners I talk to lose 20–40% to voicemail and never get a callback.
We built an AI front desk that answers every call and texts the lead in
30 seconds — bilingual EN/ES, $299/mo.

If curious, our demo line is {{demo_phone}} — call it like you're your own customer.

Open to a 10-min walk-through?
```

### 5.5 SMS (Day 6, only with consent inference)

```
{{first_name}} — Mo at SkyBridgeCX. Sent you a note re: 24/7 AI front desk for {{business_name}}. Demo line is {{demo_phone}}, takes 60s. Reply STOP to opt out.
```

Compliance: only send if (a) the owner's mobile is publicly listed as the business number, AND (b) it's between 9am–7pm local. Honor STOP immediately. Do not blast SMS — this is *one* per prospect, not a sequence.

### 5.6 Voicemail (Day 7)

```
Hey {{first_name}}, this is Mo at SkyBridgeCX — calling about the
24/7 AI front desk for {{business_name}}. Two-second pitch: we answer
every call, capture the lead, and text it to you in under 30 seconds.
Best thing to do is call the demo line at {{demo_phone}} and hear it
yourself. No pitch, no obligation. Talk soon.
```

---

## 6. Reply triage — the decision tree

When a reply comes in, classify within 60 seconds and route. The agent should always do this; humans should follow the same logic.

| Signal in reply | Class | Action |
| --- | --- | --- |
| "send me info / how does it work / what's the price" | Warm | Reply with a 4-bullet recap + demo line + booking link. Aim to convert to a 10-min call. |
| "I'm interested / let's talk / book me" | Hot | Reply within 5 minutes. Send Calendly link with 3 slots in next 48 hrs. |
| "I already use [X service]" | Switching opportunity | Acknowledge, ask one diagnostic ("what does [X] *not* do well?"), then bridge to our differentiator (price + 24/7 + bilingual + recording compliance). |
| "no thanks / not interested" | Cold | Mark "Not now," set 90-day re-engage. Do not push. |
| "remove me / unsubscribe / stop" | Hard out | Add to suppression list, confirm in one line. **Never re-contact.** |
| "what about [objection]?" | Engaged | Use objection library §7. Reply tonight. |
| Out-of-office | Snooze | Re-queue email for return date + 1 day. |

---

## 7. Objection-handling library

> Always: **acknowledge → reframe → proof → close-question.**

**"It's too expensive."**
> "Totally fair. Most owners who say that are comparing it to a $0 voicemail. The right comparison is what one missed emergency call is worth — usually $400–$2k. SkyBridge is $299/mo. If we save you one job a month, you're up. Want me to set you up on the 14-day free trial — zero risk?"

**"I don't trust an AI to talk to my customers."**
> "Hear it first. Demo line is {{demo_phone}} — call it, pretend to be a frustrated A/C customer. The agent introduces itself, says the call is recorded, captures the details, and lets the caller ask for a human anytime. If it doesn't pass your bar, walk."

**"I already use [Ruby / AnswerConnect / a human service]."**
> "Solid services — we lose to them sometimes. Two questions: do they pick up after hours and on weekends, and what does that cost you per month? We're flat $299, never sleep, and bilingual. Worth a side-by-side for two weeks?"

**"I want to talk to a real person, not a robot."**
> "Same — I'd rather you hear it than I describe it. Two minutes on the demo line. After that I'm a 10-minute call — no obligation, just want you to see if it fits."

**"My customers won't like it."**
> "We thought that too. The disclosure at the start helps — it's a calm, warm voice that says it's recording and asks how to help. Owners report **fewer** complaints than with phone trees or voicemail. Plus you get every call captured so the dropoff is gone."

**"What if it screws up an emergency?"**
> "Built for that. The agent listens for emergency triggers (no heat, gas leak, active flood, sewer backup, sparks, exposed wires), tags it Emergency, reassures the caller, and you get an alert tagged EMERGENCY in under 30 seconds. For severe gas, it tells the caller to leave the home and call 911."

**"Is this TCPA / recording-law clean?"**
> "Yes. Every call opens with a recording disclosure built into the agent — that's the cleanest path under two-party-consent states like California, Florida, Illinois. The privacy policy lists every subprocessor and we'll sign a DPA. Most home-services SMBs we onboard didn't realize they were exposed before — we fix it."

**"How fast can I be live?"**
> "Under 10 minutes. New number or port yours, record a 10-second business intro, done. We can run side-by-side with your current setup for the trial."

**"Can it speak Spanish?"**
> "Yes — bilingual auto-detect. The agent opens bilingually, then locks to whichever language the caller uses. Whole flow works in Spanish. This is a quiet differentiator vs. human services that don't have Spanish coverage."

---

## 8. Demo flow (10-minute call)

**Goal:** prospect leaves with a number on their line and a free trial started, OR a clean "no" with a reason. No middle ground.

1. **0:00 – 1:00 — context.** "Tell me about how calls flow today — who picks up, what happens after hours, what your worst missed-call story is." Listen, don't pitch.
2. **1:00 – 3:00 — diagnostic.** Pull 1–2 of their Google reviews on screen if any mention missed calls. Quantify their loss: "If you miss 5 calls a week and one in five is a $400 job, that's $400/wk = $20k/yr leaking."
3. **3:00 – 6:00 — live demo.** Open the dashboard. Call the demo line live, on speaker. Make them play the caller. Watch their face when the lead lands as a text.
4. **6:00 – 8:00 — pricing + trial.** $299 Starter / $499 Pro. 14-day free trial. Connect the trial number on the call (Twilio number provisioned, paste TwiML, done).
5. **8:00 – 10:00 — close.** "I can flip yours on right now or tomorrow morning — your call." Soft commit beats a 'maybe.' If they hesitate, offer "trial number in parallel, ring both for two weeks, you decide."

If they say no in the demo, ask "what would have to be true for this to be a yes?" and capture the answer. That's the future re-engage hook.

---

## 9. Pipeline stages and exit criteria

| Stage | Definition | Exit criteria |
| --- | --- | --- |
| Sourced | In CSV, not yet contacted | Sent T1 |
| Active | Mid-cadence | Replied OR cadence ended |
| Engaged | Replied with anything other than "no" | Demo booked |
| Demo Booked | Calendar event held | Demo held |
| Demo Held | Met live | Trial started OR Lost |
| Trial | On the 14-day free trial | Paid OR Churned |
| Won | First payment captured | — |
| Lost | Said no with reason | 90-day re-engage |

**Healthy ratios for our motion (calibrate after first 200 prospects):**

- Sourced → Engaged: 8–12% (cold-email norms)
- Engaged → Demo Held: 35–50%
- Demo Held → Trial: 60–80% (live demo with the phone number is high-converting)
- Trial → Won: 50–70% (depends on first-week call volume)
- End-to-end Sourced → Won: ~1.5–3%, target $400–$700 CAC at $299 ACV with 18–24 month LTV.

If you fall below these, the issue is almost always upstream: weak ICP fit or weak trigger personalization. Fix the list before you fix the copy.

---

## 10. Weekly ops cadence

| Day | What runs |
| --- | --- |
| Mon AM | Pipeline review: every Engaged+ deal, what moves it this week. New list-build for next week. |
| Mon PM | Send T1 batch (60). Live calls top-20. |
| Tue–Fri | Continue cadence per §4. Reply triage within 60 minutes during business hours. |
| Wed | LinkedIn DM batch. |
| Fri PM | Demo-day blocks. Wins logged. Lost-with-reason logged. Update this playbook if a new objection or pattern showed up. |

---

## 11. Tools and where each one fits

| Tool / MCP | Used for |
| --- | --- |
| Apollo (`apollo:prospect`, `apollo:enrich-lead`, `apollo:sequence-load`) | Source list + enrich + bulk load into Apollo sequences |
| Common Room | Account-level signals once we have a fan base — early days, secondary |
| Gmail (`mcp__0514a224-*`) | Drafting + sending personalized email touches; reading replies for triage |
| Slack | Internal alerts on hot replies; "Won" celebration channel |
| Hubspot / Close (whichever is connected) | CRM of record. Every contact, stage, note, task lives here. |
| Clay | Enrichment of trigger signals (after-hours, recent reviews, hiring) |
| Klaviyo | Nurture flows for "Lost — 90 day re-engage" cohort |

When a tool isn't connected, the agent should degrade: skip the integration, log the action as a manual TODO for Mo, and keep moving.

---

## 12. What the outreach agent must never do

- Pretend to be human. Always identifiable as an AI when asked.
- Send to a domain on the suppression list.
- Send more than one SMS to a prospect without explicit consent.
- Make up reviews, testimonials, customer names, or numbers.
- Quote prices outside the published $299 / $499 tiers.
- Promise integrations or features that aren't shipped (current list lives in `/lp/home-services` — match it).
- Sign or accept any contract terms on Mo's behalf.
- Move budget, schedule meetings on Mo's calendar without confirmation, or send from a personal email without permission.

---

## 13. Metrics to report (weekly)

The agent should compile and ship to Mo every Friday 4pm:

- New prospects sourced
- T1/T2/T3 sends, opens, replies, reply-rate
- LinkedIn touches + acceptance rate
- Live calls placed + connect rate
- Demos booked, demos held, demo show-rate
- Trials started
- Wins (and ARR added)
- Losses with reasons (top 3)
- One thing to change next week

Save the report as `docs/outreach/WEEKLY_<YYYY-MM-DD>.md` so we have a paper trail.

---

## 14. North-star: stay obsessed with one number

**New paying customers per week.**

Nothing else matters until that number is reliably > 1.
