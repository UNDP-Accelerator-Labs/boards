CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TABLE projects (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	title TEXT
);

CREATE TABLE groups (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	label VARCHAR (99),
	x DOUBLE PRECISION,
	y DOUBLE PRECISION,
	project INT REFERENCES projects (id) ON UPDATE CASCADE ON DELETE CASCADE,
	tree ltree DEFAULT text2ltree('0')
);

CREATE TABLE notes (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	content TEXT,
	x DOUBLE PRECISION,
	y DOUBLE PRECISION,
	project INT REFERENCES projects (id) ON UPDATE CASCADE ON DELETE CASCADE,
	tree ltree DEFAULT text2ltree('0')
);

CREATE TABLE cards (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	content JSONB,
	x DOUBLE PRECISION,
	y DOUBLE PRECISION,
	project INT REFERENCES projects (id) ON UPDATE CASCADE ON DELETE CASCADE,
	tree ltree DEFAULT text2ltree('0'),
	source TEXT
);

CREATE TABLE datasources (
	id SERIAL PRIMARY KEY UNIQUE NOT NULL,
	query TEXT,
	platform VARCHAR (99),
	loaded INT,
	total INT,
	project INT REFERENCES projects (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE session (
    sid varchar NOT NULL COLLATE "default",
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
) WITH (OIDS = FALSE);
ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IDX_session_expire ON session ("expire");
