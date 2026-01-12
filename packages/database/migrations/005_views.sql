-- ============================================
-- ArcVest Marketing Automation System
-- Migration 005: Database Views
-- ============================================

-- ============================================
-- LEAD FUNNEL SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW lead_funnel_summary AS
SELECT
    status,
    COUNT(*) as count,
    ROUND(AVG(lead_score)::numeric, 1) as avg_score,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - status_changed_at)) / 86400)::numeric, 0)::INTEGER as avg_days_in_status
FROM contacts
WHERE deleted_at IS NULL
  AND status NOT IN ('closed_lost')
GROUP BY status
ORDER BY
    CASE status
        WHEN 'new_lead' THEN 1
        WHEN 'contacted' THEN 2
        WHEN 'consultation_scheduled' THEN 3
        WHEN 'consultation_completed' THEN 4
        WHEN 'proposal_sent' THEN 5
        WHEN 'client' THEN 6
    END;

-- ============================================
-- SOURCE PERFORMANCE VIEW
-- ============================================

CREATE OR REPLACE VIEW source_performance AS
SELECT
    c.source,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE c.status = 'client') as clients_won,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE c.status = 'client') / NULLIF(COUNT(*), 0),
        2
    ) as conversion_rate,
    ROUND(AVG(c.lead_score)::numeric, 1) as avg_lead_score
FROM contacts c
WHERE c.deleted_at IS NULL
GROUP BY c.source
ORDER BY total_leads DESC;

-- ============================================
-- HOT LEADS VIEW (score >= 70)
-- ============================================

CREATE OR REPLACE VIEW hot_leads AS
SELECT
    c.*,
    (SELECT MAX(created_at) FROM interactions WHERE contact_id = c.id) as last_interaction,
    (SELECT COUNT(*) FROM interactions WHERE contact_id = c.id) as interaction_count
FROM contacts c
WHERE c.lead_score >= 70
  AND c.status NOT IN ('client', 'closed_lost')
  AND c.deleted_at IS NULL
ORDER BY c.lead_score DESC;

-- ============================================
-- PENDING TASKS DASHBOARD VIEW
-- ============================================

CREATE OR REPLACE VIEW pending_tasks_dashboard AS
SELECT
    t.*,
    c.first_name as contact_first_name,
    c.last_name as contact_last_name,
    c.email as contact_email,
    CASE
        WHEN t.due_date < NOW() THEN 'overdue'
        WHEN t.due_date < NOW() + INTERVAL '1 day' THEN 'due_today'
        WHEN t.due_date < NOW() + INTERVAL '7 days' THEN 'due_this_week'
        ELSE 'upcoming'
    END as urgency
FROM tasks t
LEFT JOIN contacts c ON t.contact_id = c.id
WHERE t.status = 'pending'
ORDER BY
    CASE t.priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
    END,
    t.due_date ASC NULLS LAST;

-- ============================================
-- SEQUENCE EMAIL QUEUE VIEW
-- ============================================

CREATE OR REPLACE VIEW sequence_email_queue AS
SELECT
    se.id as enrollment_id,
    se.contact_id,
    c.email,
    c.first_name,
    c.last_name,
    es.name as sequence_name,
    es.id as sequence_id,
    ess.subject,
    ess.body,
    ess.step_order,
    se.next_email_at
FROM sequence_enrollments se
JOIN contacts c ON se.contact_id = c.id
JOIN email_sequences es ON se.sequence_id = es.id
JOIN email_sequence_steps ess ON es.id = ess.sequence_id AND ess.step_order = se.current_step
WHERE se.status = 'active'
  AND se.next_email_at <= NOW()
  AND c.deleted_at IS NULL
  AND es.status = 'active'
  AND ess.status = 'active'
ORDER BY se.next_email_at;

-- ============================================
-- CONTACT TIMELINE VIEW
-- ============================================

CREATE OR REPLACE VIEW contact_timeline AS
SELECT
    i.id,
    i.contact_id,
    i.created_at,
    i.type as event_type,
    'interaction' as source,
    i.subject as title,
    i.summary as description,
    i.outcome,
    i.metadata
FROM interactions i
UNION ALL
SELECT
    t.id,
    t.contact_id,
    t.created_at,
    'task_created' as event_type,
    'task' as source,
    t.title,
    t.description,
    t.status as outcome,
    t.metadata
FROM tasks t
WHERE t.contact_id IS NOT NULL
UNION ALL
SELECT
    se.id,
    se.contact_id,
    se.enrolled_at as created_at,
    'sequence_enrolled' as event_type,
    'sequence' as source,
    es.name as title,
    NULL as description,
    se.status as outcome,
    '{}'::jsonb as metadata
FROM sequence_enrollments se
JOIN email_sequences es ON se.sequence_id = es.id
ORDER BY created_at DESC;

-- ============================================
-- CAMPAIGN PERFORMANCE SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW campaign_performance_summary AS
SELECT
    c.id,
    c.name,
    c.type,
    c.status,
    c.budget_monthly,
    COALESCE(SUM(cm.impressions), 0) as total_impressions,
    COALESCE(SUM(cm.clicks), 0) as total_clicks,
    COALESCE(SUM(cm.cost), 0) as total_cost,
    COALESCE(SUM(cm.conversions), 0) as total_conversions,
    CASE
        WHEN SUM(cm.impressions) > 0
        THEN ROUND((SUM(cm.clicks)::numeric / SUM(cm.impressions)::numeric) * 100, 2)
        ELSE 0
    END as avg_ctr,
    CASE
        WHEN SUM(cm.clicks) > 0
        THEN ROUND(SUM(cm.cost)::numeric / SUM(cm.clicks)::numeric, 2)
        ELSE 0
    END as avg_cpc,
    CASE
        WHEN SUM(cm.conversions) > 0
        THEN ROUND(SUM(cm.cost)::numeric / SUM(cm.conversions)::numeric, 2)
        ELSE NULL
    END as avg_cpa
FROM campaigns c
LEFT JOIN campaign_metrics cm ON c.id = cm.campaign_id
GROUP BY c.id, c.name, c.type, c.status, c.budget_monthly
ORDER BY total_cost DESC;

-- ============================================
-- PENDING APPROVALS VIEW
-- ============================================

CREATE OR REPLACE VIEW pending_approvals AS
SELECT
    aq.*,
    EXTRACT(EPOCH FROM (NOW() - aq.created_at)) / 3600 as hours_pending,
    CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - aq.created_at)) / 3600 > 72 THEN 'escalated'
        WHEN EXTRACT(EPOCH FROM (NOW() - aq.created_at)) / 3600 > 48 THEN 'needs_reminder'
        ELSE 'normal'
    END as urgency_status
FROM approval_queue aq
WHERE aq.status = 'pending'
ORDER BY
    CASE aq.priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
    END,
    aq.created_at ASC;

-- ============================================
-- AGENT TASK SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW agent_task_summary AS
SELECT
    assigned_agent,
    status,
    COUNT(*) as task_count,
    AVG(attempts) as avg_attempts
FROM agent_tasks
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY assigned_agent, status
ORDER BY assigned_agent, status;

-- ============================================
-- CONTENT CALENDAR OVERVIEW VIEW
-- ============================================

CREATE OR REPLACE VIEW content_calendar_overview AS
SELECT
    cc.id,
    cc.title,
    cc.content_type,
    cc.status,
    cc.scheduled_date,
    cc.published_at,
    cc.views,
    cc.engagements,
    cc.leads_attributed,
    cc.target_keyword,
    CASE
        WHEN cc.status = 'published' THEN 'published'
        WHEN cc.scheduled_date < CURRENT_DATE THEN 'overdue'
        WHEN cc.scheduled_date = CURRENT_DATE THEN 'due_today'
        WHEN cc.scheduled_date <= CURRENT_DATE + 7 THEN 'due_this_week'
        ELSE 'upcoming'
    END as schedule_status
FROM content_calendar cc
WHERE cc.status NOT IN ('archived')
ORDER BY cc.scheduled_date ASC NULLS LAST;

-- ============================================
-- KEYWORD RANKINGS SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW keyword_rankings_summary AS
SELECT
    tk.id,
    tk.keyword,
    tk.search_volume,
    tk.difficulty,
    tk.current_rank,
    tk.previous_rank,
    tk.current_rank - tk.previous_rank as rank_change,
    CASE
        WHEN tk.current_rank IS NULL THEN 'not_ranking'
        WHEN tk.current_rank <= 3 THEN 'top_3'
        WHEN tk.current_rank <= 10 THEN 'page_1'
        WHEN tk.current_rank <= 20 THEN 'page_2'
        ELSE 'page_3_plus'
    END as position_tier,
    tk.target_url,
    tk.url_ranking,
    tk.priority,
    tk.last_checked
FROM tracked_keywords tk
ORDER BY
    CASE tk.priority
        WHEN 'primary' THEN 1
        WHEN 'secondary' THEN 2
        WHEN 'monitor' THEN 3
    END,
    tk.current_rank ASC NULLS LAST;
