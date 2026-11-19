CREATE TABLE customers (
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL,
 address TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE customer_phones (
 customer_id INTEGER NOT NULL REFERENCES customers(id),
 position INTEGER NOT NULL,
 phone TEXT NOT NULL,
 normalized TEXT NOT NULL,
 PRIMARY KEY(customer_id,position),
 UNIQUE(customer_id,normalized)
);
CREATE INDEX customer_phone_lookup ON customer_phones(normalized);
