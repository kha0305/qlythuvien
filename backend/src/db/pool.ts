import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { config } from '../config';

// Kiểu connection dùng chung: Pool cho truy vấn thường,
// PoolConnection khi service truyền transaction vào repository.
export type DbConn = Pool | PoolConnection;

export const pool: Pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: false, // giữ DATETIME thành đối tượng Date
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
});
