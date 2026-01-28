-- Custom Forms Database Schema for Cloudflare D1

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,           
    design TEXT NOT NULL,         
    script_url TEXT,
    spreadsheet_url TEXT,
    sheet_tab TEXT,
    status TEXT DEFAULT 'open',      
    created_at INTEGER NOT NULL,     
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);

-- Responses table
CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY,
    form_slug TEXT NOT NULL,
    form_id TEXT NOT NULL,
    data TEXT NOT NULL,              
    submitted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_responses_form_slug ON responses(form_slug);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at);

-- Images table (R2 tracking)
CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,             
    filename TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    r2_url TEXT NOT NULL,
    uploaded_at INTEGER NOT NULL,
    form_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_images_form_id ON images(form_id);

-- Form stats cache
CREATE TABLE IF NOT EXISTS form_stats (
    form_slug TEXT PRIMARY KEY,
    response_count INTEGER DEFAULT 0,
    last_response_at INTEGER
);
