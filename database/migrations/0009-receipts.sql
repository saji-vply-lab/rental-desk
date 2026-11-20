CREATE TABLE receipt_documents(
 rental_id INTEGER NOT NULL REFERENCES inquiries(id),
 document_key TEXT NOT NULL,
 content TEXT NOT NULL,
 PRIMARY KEY(rental_id,document_key)
);
