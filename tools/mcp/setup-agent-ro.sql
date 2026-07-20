-- команда для выполнения
-- docker compose exec -T db psql -U wakaba -d wakaba < tools/mcp/setup-agent-ro.sql

CREATE ROLE agent_ro LOGIN PASSWORD 'ig#j98mnFSl1rklnk!#f93MZ';

GRANT CONNECT ON DATABASE wakaba TO agent_ro;

GRANT USAGE ON SCHEMA public TO agent_ro;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO agent_ro;

ALTER ROLE agent_ro SET default_transaction_read_only = on;

ALTER ROLE agent_ro SET statement_timeout = '5s';
