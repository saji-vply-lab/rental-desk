CREATE VIEW rental_settlement AS
 SELECT s.*, CASE WHEN status='Cancelled' AND paid=0 THEN 1
 WHEN status='Completed' AND total IS NOT NULL AND total=paid THEN 1 ELSE 0 END AS closed
 FROM (SELECT i.id,i.status,b.total,COALESCE((SELECT SUM(amount) FROM billing_entries e WHERE e.rental_id=i.id AND e.method<>''),0) AS paid
 FROM inquiries i LEFT JOIN bills b ON b.rental_id=i.id WHERE i.kind='rental-draft') s;
