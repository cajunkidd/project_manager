-- Provisioning script run by the postgres container on first boot.
-- Creates the dedicated test database alongside the main one.
CREATE DATABASE project_manager_test OWNER pmuser;
