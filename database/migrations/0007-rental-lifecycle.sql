ALTER TABLE inquiries ADD COLUMN status TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE inquiries ADD COLUMN customer_snapshot TEXT;
ALTER TABLE inquiries ADD COLUMN issued_at TEXT;
ALTER TABLE inquiries ADD COLUMN source_inquiry INTEGER REFERENCES inquiries(id);
CREATE UNIQUE INDEX one_rental_per_inquiry ON inquiries(source_inquiry);
ALTER TABLE inquiry_lines ADD COLUMN returned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inquiry_lines ADD COLUMN agreed_rate INTEGER;
ALTER TABLE inquiry_lines ADD COLUMN agreed_model TEXT;
ALTER TABLE inquiry_lines ADD COLUMN agreed_period INTEGER;
CREATE TABLE rental_events (
 id INTEGER PRIMARY KEY, rental_id INTEGER NOT NULL REFERENCES inquiries(id),
 action TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 position INTEGER, quantity INTEGER, condition TEXT, remaining INTEGER
);
CREATE INDEX rental_event_history ON rental_events(rental_id,id);
CREATE VIEW stock_commitments AS
 SELECT i.id AS rental_id,i.status,l.item_id,l.quantity-l.returned AS units,
 CASE WHEN i.status='Booked' THEN COALESCE(l.start_override,i.start) ELSE date(i.issued_at) END AS start,
 CASE WHEN i.status='Booked' THEN COALESCE(l.due_override,i.due)
 ELSE MAX(date('now'),COALESCE(l.due_override,i.due)) END AS due
 FROM inquiries i JOIN inquiry_lines l ON l.inquiry_id=i.id
 WHERE i.status IN ('Booked','Issued','Partially returned') AND l.quantity>l.returned;
CREATE VIEW rental_risk AS
 WITH booked AS (SELECT * FROM stock_commitments WHERE status='Booked'),
 days AS (SELECT item_id,start AS day FROM booked)
 SELECT DISTINCT b.rental_id,b.item_id FROM booked b
 JOIN days d ON d.item_id=b.item_id AND d.day BETWEEN b.start AND b.due
 JOIN items it ON it.id=b.item_id
 WHERE it.owned-it.unusable-
 COALESCE((SELECT SUM(units) FROM stock_commitments s WHERE s.item_id=b.item_id AND s.status<>'Booked'),0)
 < (SELECT SUM(units) FROM booked other WHERE other.item_id=b.item_id AND d.day BETWEEN other.start AND other.due);
