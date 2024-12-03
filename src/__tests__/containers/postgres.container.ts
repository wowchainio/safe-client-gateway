import configuration from '@/config/entities/__tests__/configuration';
import { PostgreSqlContainer as PostgreSqlTestContainer } from '@testcontainers/postgresql';

export const PostgreSqlContainer = (): PostgreSqlTestContainer => {
  const config = configuration();
  const postgresContainer = new PostgreSqlTestContainer();
  const database = config.db.connection.postgres.database;
  postgresContainer.withDatabase(database);
  const username = config.db.connection.postgres.username;
  postgresContainer.withUsername(username);
  postgresContainer.withPassword(config.db.connection.postgres.password);
  postgresContainer.withHealthCheck({
    test: ['CMD-SHELL', `sh -c 'pg_isready -U ${username} -d ${database}'`],
    interval: 1000,
    timeout: 3000,
    retries: 5,
    startPeriod: 1000,
  });

  return postgresContainer;
};
