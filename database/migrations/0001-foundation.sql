CREATE TABLE tenants (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  receipt_footer TEXT NOT NULL DEFAULT ''
);
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  zone TEXT NOT NULL,
  subzone TEXT NOT NULL,
  owned INTEGER NOT NULL CHECK(owned >= 0),
  unusable INTEGER NOT NULL DEFAULT 0 CHECK(unusable BETWEEN 0 AND owned)
);
