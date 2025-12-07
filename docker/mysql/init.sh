#!/bin/bash
set -e

echo "Aplicando configurações de segurança e usuários..."

# Espera o MySQL estar realmente pronto
until mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "SELECT 1" > /dev/null 2>&1; do
  echo "Aguardando MySQL ficar pronto..."
  sleep 2
done


mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
  CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`;

  CREATE USER IF NOT EXISTS '${MYSQL_APP_USER}'@'%' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';
  GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_APP_USER}'@'%';

  CREATE USER IF NOT EXISTS '${MYSQL_MIGRATE_USER}'@'%' IDENTIFIED BY '${MYSQL_MIGRATE_PASSWORD}';
  GRANT ALL PRIVILEGES ON *.* TO '${MYSQL_MIGRATE_USER}'@'%' WITH GRANT OPTION;

  FLUSH PRIVILEGES;
EOSQL

echo "Usuários criados com sucesso!"
echo "→ App user: ${MYSQL_APP_USER}"
echo "→ Migrate user: ${MYSQL_MIGRATE_USER}"