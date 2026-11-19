CREATE TABLE billing_entries (
 id INTEGER PRIMARY KEY, rental_id INTEGER NOT NULL REFERENCES inquiries(id),
 request_id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, amount INTEGER NOT NULL,
 method TEXT NOT NULL, reference TEXT NOT NULL, note TEXT NOT NULL,
 effective_date TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reversed_id INTEGER UNIQUE REFERENCES billing_entries(id), percent_bps INTEGER,
 actor TEXT NOT NULL
);
CREATE INDEX entries_by_rental ON billing_entries(rental_id,id);
CREATE TABLE bills (
 rental_id INTEGER PRIMARY KEY REFERENCES inquiries(id),
 total INTEGER NOT NULL, snapshot TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE inquiries ADD COLUMN late_rate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inquiries ADD COLUMN grace_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rental_events ADD COLUMN billing_snapshot TEXT;
