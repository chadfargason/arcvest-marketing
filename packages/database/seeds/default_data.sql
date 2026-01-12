-- ============================================
-- ArcVest Marketing Automation System
-- Seed Data: Default Configuration
-- ============================================

-- ============================================
-- CONTENT TEMPLATES
-- ============================================

INSERT INTO content_templates (name, content_type, template, instructions, examples) VALUES
(
    'Blog Post - Educational',
    'blog_post',
    E'# {{title}}\n\n## Introduction\n{{introduction}}\n\n## Key Points\n{{key_points}}\n\n## What This Means for You\n{{implications}}\n\n## Next Steps\n{{call_to_action}}\n\n---\n*{{disclaimer}}*',
    'Educational blog posts should explain complex financial concepts in accessible terms. Focus on helping readers understand, not selling services. Include practical examples when possible.',
    '[{"title": "Understanding Required Minimum Distributions", "topic": "RMD rules and strategies"}]'::jsonb
),
(
    'Blog Post - Market Commentary',
    'blog_post',
    E'# {{title}}\n\n## Market Overview\n{{overview}}\n\n## What We''re Watching\n{{key_factors}}\n\n## Our Perspective\n{{perspective}}\n\n## Staying the Course\n{{advice}}\n\n---\n*{{disclaimer}}*',
    'Market commentary should be balanced and avoid predictions. Focus on long-term perspective and the importance of staying invested according to plan.',
    '[{"title": "Q1 2024 Market Review", "topic": "quarterly market analysis"}]'::jsonb
),
(
    'LinkedIn Post',
    'linkedin_post',
    E'{{hook}}\n\n{{body}}\n\n{{call_to_action}}\n\n#FinancialPlanning #RetirementPlanning #FiduciaryAdvice',
    'LinkedIn posts should be professional but conversational. Lead with a compelling hook. Keep under 1300 characters for full visibility.',
    '[{"hook": "The biggest mistake I see retirees make isn''t about investments...", "topic": "retirement planning tips"}]'::jsonb
),
(
    'Newsletter - Monthly',
    'newsletter',
    E'Subject: {{subject}}\n\n# ArcVest Monthly Update\n\nDear {{first_name}},\n\n## This Month''s Focus\n{{main_topic}}\n\n## Market Update\n{{market_summary}}\n\n## Upcoming\n{{upcoming_items}}\n\n## Featured Article\n{{featured_article}}\n\nAs always, we''re here if you have questions.\n\nBest regards,\nThe ArcVest Team\n\n---\n*{{disclaimer}}*',
    'Monthly newsletters should provide value through education and updates. Avoid sales language. Include one actionable tip.',
    '[]'::jsonb
),
(
    'Google RSA Headlines',
    'ad_copy',
    E'Headline 1: {{headline_1}}\nHeadline 2: {{headline_2}}\nHeadline 3: {{headline_3}}\nHeadline 4: {{headline_4}}\nHeadline 5: {{headline_5}}\nHeadline 6: {{headline_6}}\nHeadline 7: {{headline_7}}\nHeadline 8: {{headline_8}}\nHeadline 9: {{headline_9}}\nHeadline 10: {{headline_10}}\nHeadline 11: {{headline_11}}\nHeadline 12: {{headline_12}}\nHeadline 13: {{headline_13}}\nHeadline 14: {{headline_14}}\nHeadline 15: {{headline_15}}',
    'Generate 15 headlines max 30 characters each. Include: brand name, location, fee-only/fiduciary, services, benefits. Avoid superlatives and guarantees.',
    '[]'::jsonb
),
(
    'Google RSA Descriptions',
    'ad_copy',
    E'Description 1: {{description_1}}\nDescription 2: {{description_2}}\nDescription 3: {{description_3}}\nDescription 4: {{description_4}}',
    'Generate 4 descriptions max 90 characters each. Include clear value proposition and call to action. Avoid promising specific outcomes.',
    '[]'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================
-- SAMPLE EMAIL SEQUENCES
-- ============================================

-- Welcome sequence for new leads
INSERT INTO email_sequences (id, name, description, trigger_type, trigger_config, status) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'New Lead Welcome Series',
    'Automated welcome sequence for new leads from website forms',
    'form_submission',
    '{"form_type": "contact_form"}'::jsonb,
    'active'
);

INSERT INTO email_sequence_steps (sequence_id, step_order, delay_days, subject, body, status) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    1,
    0,
    'Welcome to ArcVest - Your Next Steps',
    E'Hi {{first_name}},\n\nThank you for reaching out to ArcVest. We received your inquiry and wanted to personally welcome you.\n\nAs a fee-only fiduciary firm, we''re committed to providing objective advice that''s always in your best interest. We don''t earn commissions on products, so our recommendations are based solely on what''s right for you.\n\nHere''s what happens next:\n1. One of our advisors will review your inquiry\n2. We''ll reach out within 1 business day to schedule a complimentary consultation\n3. During our call, we''ll discuss your goals and see if we''re a good fit\n\nIn the meantime, you might find these resources helpful:\n- Our approach to retirement planning: [link]\n- Understanding fiduciary vs. broker advice: [link]\n\nWe look forward to speaking with you.\n\nBest regards,\nThe ArcVest Team',
    'active'
),
(
    'a0000000-0000-0000-0000-000000000001',
    2,
    3,
    'What to Expect in Your Consultation',
    E'Hi {{first_name}},\n\nWe wanted to share what you can expect during your complimentary consultation with ArcVest.\n\nOur consultations are designed to:\n- Understand your current financial situation\n- Discuss your retirement goals and concerns\n- Identify any immediate planning opportunities\n- Determine if our services are a good fit\n\nThere''s no pressure and no obligation. Our goal is simply to see if we can help.\n\nTo make the most of our time together, you might consider:\n- Your most important financial questions\n- Any specific concerns about retirement\n- A general sense of your current savings and income\n\nHaven''t scheduled yet? Reply to this email or call us at [phone] to set up a time.\n\nBest regards,\nThe ArcVest Team',
    'active'
),
(
    'a0000000-0000-0000-0000-000000000001',
    3,
    7,
    'A Resource for Your Retirement Planning',
    E'Hi {{first_name}},\n\nWe wanted to share a resource that many of our clients have found valuable.\n\n[Featured Article/Guide Title]\n\nThis covers [brief description of content and why it''s relevant].\n\nRead it here: [link]\n\nIf you have questions after reading, or if you''d like to discuss how these concepts apply to your situation, we''re here to help.\n\nBest regards,\nThe ArcVest Team',
    'active'
);

-- Consultation follow-up sequence
INSERT INTO email_sequences (id, name, description, trigger_type, trigger_config, status) VALUES
(
    'a0000000-0000-0000-0000-000000000002',
    'Post-Consultation Follow-Up',
    'Follow-up sequence after initial consultation',
    'status_change',
    '{"new_status": "consultation_completed"}'::jsonb,
    'active'
);

INSERT INTO email_sequence_steps (sequence_id, step_order, delay_days, subject, body, status) VALUES
(
    'a0000000-0000-0000-0000-000000000002',
    1,
    1,
    'Thank You for Meeting with Us',
    E'Hi {{first_name}},\n\nThank you for taking the time to meet with us. We enjoyed learning about your goals and discussing how we might help.\n\nAs we discussed, [personalized recap would go here - this is a template].\n\nOur next step would be [specific next step]. If you have any questions in the meantime, please don''t hesitate to reach out.\n\nBest regards,\n{{advisor_name}}\nArcVest',
    'active'
),
(
    'a0000000-0000-0000-0000-000000000002',
    2,
    5,
    'Following Up on Our Conversation',
    E'Hi {{first_name}},\n\nI wanted to follow up on our recent conversation and see if you have any questions.\n\nI know making decisions about your financial future is important, and we''re here to help however we can - whether that''s answering questions, providing additional information, or simply giving you time to consider your options.\n\nIs there anything I can clarify or help with?\n\nBest regards,\n{{advisor_name}}\nArcVest',
    'active'
);

-- ============================================
-- DEFAULT TRACKED KEYWORDS
-- ============================================

INSERT INTO tracked_keywords (keyword, search_volume, difficulty, priority, target_url) VALUES
('fee-only financial advisor', 2400, 45, 'primary', 'https://arcvest.com/'),
('fiduciary financial advisor', 3600, 52, 'primary', 'https://arcvest.com/'),
('retirement planning services', 1900, 48, 'primary', 'https://arcvest.com/services/retirement-planning'),
('fee-only financial advisor near me', 1300, 38, 'primary', 'https://arcvest.com/'),
('fiduciary advisor vs broker', 880, 35, 'secondary', 'https://arcvest.com/blog/'),
('retirement income planning', 1600, 42, 'secondary', 'https://arcvest.com/services/'),
('RMD strategies', 720, 32, 'secondary', 'https://arcvest.com/blog/'),
('social security optimization', 1200, 44, 'secondary', 'https://arcvest.com/blog/'),
('tax-efficient retirement withdrawal', 590, 28, 'secondary', 'https://arcvest.com/blog/'),
('independent financial advisor', 2100, 41, 'monitor', 'https://arcvest.com/')
ON CONFLICT (keyword) DO NOTHING;

-- ============================================
-- DEFAULT COMPETITORS
-- ============================================

INSERT INTO competitors (domain, name, type, notes) VALUES
('garrettplanningnetwork.com', 'Garrett Planning Network', 'direct', 'Fee-only advisor network'),
('napfa.org', 'NAPFA', 'content', 'Fee-only advisor association - content competitor'),
('kitces.com', 'Kitces.com', 'content', 'Financial planning blog - content reference'),
('whitecoatinvestor.com', 'White Coat Investor', 'content', 'Medical professional finance blog')
ON CONFLICT (domain) DO NOTHING;

-- ============================================
-- INITIAL SYSTEM STATE
-- ============================================

-- Ensure system state entries exist
INSERT INTO system_state (key, value) VALUES
    ('email_sequences_enabled', 'true'),
    ('auto_assignment_enabled', 'true'),
    ('content_auto_publish', 'false'),
    ('paid_media_auto_optimize', 'false'),
    ('daily_report_enabled', 'true'),
    ('weekly_report_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

