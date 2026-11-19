CREATE TABLE inquiries (
 id INTEGER PRIMARY KEY,
 request_id TEXT NOT NULL UNIQUE,
 customer_id INTEGER NOT NULL REFERENCES customers(id),
 start TEXT NOT NULL,
 due TEXT NOT NULL
);
CREATE TABLE inquiry_lines (
 inquiry_id INTEGER NOT NULL REFERENCES inquiries(id),
 position INTEGER NOT NULL,
 item_id TEXT NOT NULL REFERENCES items(id),
 item_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0),
 start_override TEXT,
 due_override TEXT,
 PRIMARY KEY(inquiry_id,position)
);
