-- команда для выполнения
-- docker compose exec -T db psql -U wakaba -d wakaba -v agent_password="$AGENT_RO_PASSWORD" < tools/mcp/setup-agent-ro.sql

CREATE ROLE agent_ro LOGIN PASSWORD 'agent_password';

GRANT CONNECT ON DATABASE wakaba TO agent_ro;

GRANT USAGE ON SCHEMA public TO agent_ro;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO agent_ro;

ALTER ROLE agent_ro SET default_transaction_read_only = on;

ALTER ROLE agent_ro SET statement_timeout = '5s';
