ALTER TABLE inquiries ADD COLUMN kind TEXT NOT NULL DEFAULT 'inquiry' CHECK(kind IN ('inquiry','rental-draft'));
ALTER TABLE inquiries ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
