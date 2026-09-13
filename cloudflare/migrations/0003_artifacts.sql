-- JSON fragments keep each row below D1's row size limit. A batch replaces a record atomically.
CREATE TABLE artifacts(key TEXT NOT NULL,part INTEGER NOT NULL,value TEXT NOT NULL,PRIMARY KEY(key,part));
