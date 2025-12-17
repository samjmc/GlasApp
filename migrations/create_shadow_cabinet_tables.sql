CREATE TABLE IF NOT EXISTS shadow_cabinet_analyses (
  id SERIAL PRIMARY KEY,
  article_title TEXT NOT NULL,
  article_url TEXT NOT NULL,
  deployed_agents TEXT,
  manager_reasoning TEXT,
  protocol_overrides TEXT,
  final_verdict TEXT,
  futurist_timeline TEXT,
  agent_reports TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qa_audits (
  id SERIAL PRIMARY KEY,
  audit_type TEXT NOT NULL,
  anomalies_found INTEGER DEFAULT 0,
  report TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);






