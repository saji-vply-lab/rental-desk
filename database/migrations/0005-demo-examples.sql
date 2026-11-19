-- Executed once, inside the startup migration transaction, for demo databases only.
-- Allocate item IDs beyond the current maximum so upgraded shops keep their own IDs.
CREATE TEMP TABLE demo_catalog AS
WITH examples(seq,name,category,description,zone,subzone,owned,unusable,model,period,rate,cost,replacement,active) AS (VALUES
 (1,'Banquet table','Furniture','Six-seat folding table','Store A','Rack 1',12,1,'Daily',1,15000,420000,480000,1),
 (2,'Canvas canopy','Covers & Sheets','Water-resistant event cover','Store A','Rack 4',6,0,'Fixed period',3,75000,650000,720000,1),
 (3,'Ground sheet','Covers & Sheets','Washable ground cover','Store A','Rack 4',18,2,'Daily',1,4000,55000,65000,1),
 (4,'Rotary drill','Tools & Machinery','Corded drill with carry case','Workshop','Cabinet 2',5,1,'Daily',1,22000,540000,600000,1),
 (5,'Tile cutter','Tools & Machinery','Manual ceramic tile cutter','Workshop','Rack 1',3,0,'Fixed period',2,35000,630000,700000,1),
 (6,'Extension ladder','Tools & Machinery','Aluminium extension ladder','Workshop','Wall bay',4,0,'Daily',1,18000,850000,900000,1),
 (7,'Stock pot','Cooking Vessels & Containers','Forty-litre steel stock pot','Store C','Shelf 2',8,0,'Daily',1,12000,290000,320000,1),
 (8,'Insulated food carrier','Cooking Vessels & Containers','Insulated serving container','Store C','Shelf 3',5,0,'Fixed period',2,25000,420000,500000,1),
 (9,'Carpet sweeper','Cleaning Equipment','Older model awaiting inspection','Service bay','Bench 1',1,1,'Daily',1,9000,160000,190000,0)
), current_max(n) AS (SELECT COALESCE(MAX(CAST(substr(id,6) AS INTEGER)),0) FROM items)
SELECT printf('ITEM-%04d',n+seq) AS id,examples.* FROM examples,current_max
WHERE EXISTS(SELECT 1 FROM categories c WHERE c.name=examples.category AND c.active=1);

INSERT INTO items(id,name,category,description,zone,subzone,owned,unusable,model,period,rate,cost,replacement,active)
SELECT id,name,category,description,zone,subzone,owned,unusable,model,period,rate,cost,replacement,active FROM demo_catalog;
INSERT INTO movements(item,kind,quantity,owned,unusable,reason,actor)
SELECT id,'Opening balance',owned,owned,unusable,'Sample opening stock','Demo setup' FROM demo_catalog;

CREATE TEMP TABLE demo_customers AS
WITH examples(seq,name,address) AS (VALUES
 (1,'Demo Riverside Hall','Unit 1, Sample Event Lane'),
 (2,'Demo Workshop Club','Unit 2, Sample Maker Lane'),
 (3,'Demo Kitchen Collective','Unit 3, Sample Market Lane'))
SELECT (SELECT COALESCE(MAX(id),0) FROM customers)+seq AS id,seq,name,address FROM examples;
INSERT INTO customers(id,name,address) SELECT id,name,address FROM demo_customers;
-- NANP 555-0100 through 555-0199 are reserved for fictional use.
INSERT INTO customer_phones(customer_id,position,phone,normalized)
SELECT id,0,printf('+1 202 555 01%02d',seq),printf('120255501%02d',seq) FROM demo_customers;
INSERT INTO customer_phones(customer_id,position,phone,normalized)
SELECT id,1,'+1 202 555 0111','12025550111' FROM demo_customers WHERE seq=1;

CREATE TEMP TABLE demo_lines(customer_seq INTEGER,item_seq INTEGER,qty INTEGER,start_override TEXT,due_override TEXT);
INSERT INTO demo_lines VALUES (1,1,4,NULL,NULL),(1,2,1,NULL,date('now','+10 days')),
 (2,4,2,date('now','+15 days'),NULL),(2,5,1,NULL,NULL),(3,7,3,NULL,NULL),(3,8,2,NULL,NULL);
CREATE TEMP TABLE demo_inquiries AS
SELECT c.id AS customer_id,c.seq,lower(hex(randomblob(16))) AS request_id,
 date('now',printf('+%d days',c.seq*7)) AS start,date('now',printf('+%d days',c.seq*7+2)) AS due
FROM demo_customers c WHERE EXISTS(SELECT 1 FROM demo_lines l JOIN demo_catalog i ON i.seq=l.item_seq WHERE l.customer_seq=c.seq);
INSERT INTO inquiries(request_id,customer_id,start,due) SELECT request_id,customer_id,start,due FROM demo_inquiries;
INSERT INTO inquiry_lines(inquiry_id,position,item_id,item_name,quantity,start_override,due_override)
SELECT q.id,row_number() OVER (PARTITION BY q.id ORDER BY l.item_seq)-1,i.id,i.name,l.qty,l.start_override,l.due_override
FROM demo_lines l JOIN demo_catalog i ON i.seq=l.item_seq JOIN demo_inquiries d ON d.seq=l.customer_seq JOIN inquiries q ON q.request_id=d.request_id;
DROP TABLE demo_inquiries;
DROP TABLE demo_lines;
DROP TABLE demo_customers;
DROP TABLE demo_catalog;
