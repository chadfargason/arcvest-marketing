# ArcVest Whiteboard Video Ad Strategy

**Status:** ON HOLD — resume when ready to sign up for Golpo AI
**Created:** April 10, 2026
**Last Updated:** April 13, 2026

---

## Goal

Create short (15-second) whiteboard-style video ads for ArcVest, focused on **"how fees destroy your wealth."** These should be:
- Repeatable — generate new variations easily
- Scalable — use a tool, not a person
- Testable — A/B test different messages in Google Ads
- Cheap — ~$0.50 per video

---

## What Is a Whiteboard Video?

A whiteboard video shows concepts being drawn/written on a white background in real-time, as if someone is sketching while narrating. Think RSA Animate or Khan Academy style. Highly effective for financial education because it simplifies complex concepts and holds attention longer than static ads.

---

## Research Findings

### Tools Evaluated

| Tool | API? | Cost | Quality | Verdict |
|------|------|------|---------|---------|
| **Golpo AI** | Yes (REST + Python/Node SDKs) | $0.50/15s video ($200 min buy) | Good for short-form | **RECOMMENDED** |
| VideoScribe | No API | $15-25/month | Highest quality | Manual only, can't scale |
| Doodly | No API | $67+ | Good | Manual only, can't scale |
| Renderforest | Limited | $15-50/month | Good | Template-based, less flexible |

### Why Golpo AI Won

1. **API-first**: REST API + Python/Node SDKs. Can automate video generation.
2. **Cheapest per video**: $0.50 for a 15-second video. $200 buys 400 videos.
3. **Y Combinator backed** (Summer 2025): Legitimate, actively developed.
4. **Whiteboard style built-in**: `use_2_style: "whiteboard"` parameter.
5. **AI voiceover included**: Multiple voices, languages.
6. **Post-generation editing**: Can re-edit with text prompts.
7. **I (Claude) can call it directly**: Generate videos programmatically without human effort.

### Golpo AI Technical Details

- **API Base**: `https://video.golpoai.com/api/v1/`
- **Auth**: `x-api-key` header
- **Key endpoints**:
  - `POST /videos/generate` — Create a video from a prompt
  - `POST /videos/upload-file` — Upload audio/video/documents
  - `GET /videos` — List all videos
  - `GET /videos/{video_id}` — Get specific video
  - `GET /videos/status/{job_id}` — Poll generation status
  - `PATCH /videos/{video_id}` — Update metadata
  - `DELETE /videos/{video_id}` — Remove video

- **SDKs**:
  - Python v0.9.9 (sync/async): `create_video()`, `combine_videos()`
  - Node.js v0.1.9 (Promise-based): `createVideo()`

- **Key parameters**:
  - `use_2_style`: whiteboard, chalkboard_white, neon, modern_minimal, playful, technical, editorial, marker
  - `use_lineart_2_style`: classic/improved/advanced sketch modes
  - `pen_style`: stylus, marker, pen
  - `display_language`: controls on-screen text language
  - `user_audio_in_video`: controls AI narration placement

- **Pricing**: $1 = 1 credit. 1-minute video = 2 credits. 15-second video ≈ 0.5 credits.

---

## Creative Strategy

### Primary Message: "Fees Destroy Your Wealth"

**Core script (15 seconds):**

> *[Drawing of $1M portfolio]*
> "You invest a million dollars..."
> *[Hand draws 1% being siphoned off, year after year]*
> "A 1% fee seems small..."
> *[Number grows to $500,000 lost over 30 years]*
> "But it costs you half a million."
> *[ArcVest logo appears]*
> "ArcVest. Fee-only. On your side."

### Planned Variations (5-10 videos)

| Variation | Angle | Hook |
|-----------|-------|------|
| A | Shock value | "1% fee = $500K lost" |
| B | Personal | "Your advisor's fee vs your retirement" |
| C | Comparison | "Fee-only vs commission: the $300K difference" |
| D | Curiosity | "What Wall Street doesn't want you to know about fees" |
| E | Educational | "3 numbers that decide your retirement" |

### Why 15 Seconds

- Highest completion rates on paid social (6-15s is the sweet spot)
- Facebook counts a "view" at 3 seconds — 15s gets near 100% completion
- Google Demand Gen / YouTube in-feed works well with short-form
- Forces the message to be razor-sharp — one idea, one CTA

### Voice

- AI-generated (already used for podcast and other content)
- Male voice, professional, authoritative but warm
- No jargon — plain language

---

## Distribution Plan

### Phase 1: Generate & Test
1. Sign up for Golpo AI, get API key
2. Generate 1 test video with the primary script
3. Review quality — is the animation smooth? Voice natural? Message clear?
4. If good, generate 5-10 variations

### Phase 2: Deploy to Google Ads
1. Upload videos to YouTube (unlisted)
2. Create new Demand Gen ad variations in existing podcast campaign or a dedicated whiteboard campaign
3. A/B test whiteboard videos against current podcast video clip
4. Run for 7-14 days, measure:
   - Cost per click
   - Cost per subscriber (YouTube)
   - View completion rate
   - Click-through rate

### Phase 3: Scale Winners
1. Identify top 2-3 performing variations
2. Generate more variations of the winning angle
3. Increase budget on winners, pause losers
4. Consider expanding to Meta if the creative performs well

### Phase 4 (Optional): Automate in Pipeline
If this works well, build into arcvest-marketing codebase:
- `packages/services/src/golpo-service.ts` — Golpo API client
- Dashboard page to generate and manage whiteboard videos
- Weekly automated variation generation tied to blog topics
- Auto-upload to YouTube + create Google Ads variations

---

## Budget Estimate

| Item | Cost |
|------|------|
| Golpo AI credits (minimum buy) | $200 (400 fifteen-second videos) |
| Google Ads testing budget | Already running at $20/day |
| Total new spend | $200 one-time |

---

## To Resume This Project

When ready, Chad needs to:
1. Go to [video.golpoai.com](https://video.golpoai.com) and create an account
2. Purchase API credits ($200 minimum)
3. Give Claude the API key
4. Claude handles everything else — generate, review, upload, deploy

---

## Context: Current Ad Performance (as of April 10, 2026)

- YouTube subscribers: **407** (started at 320 on Mar 27)
- Growth rate: **~17-27 subs/day** (accelerating)
- Google Demand Gen podcast campaign: **$20/day**, driving most subscriber growth
- Current video asset: 10.5-second Riverside podcast clip ("Why invest in markets")
- Whiteboard videos would add variety to the creative mix and test a different format

---

## Related Documents

- `docs/ad-tracking-reference.md` — All account IDs, tags, conversion tracking setup
- Memory: `ad-spend-strategy.md` — Current spend allocation and optimization history
- Memory: `google-ads-api-playbook.md` — How to create/manage Google Ads campaigns via API
