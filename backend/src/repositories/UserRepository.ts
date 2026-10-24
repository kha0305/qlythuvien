import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DbConn, pool } from '../db/pool';
import { User, UserRole } from '../entities/User';
import { resolveOrderBy } from '../utils/sort';

/** Whitelist sort cho danh sách user (dùng chung cho listReaders / listByRole / listByRoles). */
const USER_SORTS: Record<string, string> = {
  name_asc: 'full_name ASC, id DESC',
  role: 'role ASC, full_name ASC, id DESC',
};

function userOrderBy(sort: unknown, fallback: string): string {
  return resolveOrderBy(sort, USER_SORTS, fallback);
}

function mapRow(row: RowDataPacket): User {
  return new User({
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    role: row.role as UserRole,
    studentCode: row.student_code,
    phone: row.phone,
    email: row.email ?? null,
    emailVerified: Number(row.email_verified ?? 0) === 1,
    avatarUrl: row.avatar_url ?? null,
    active: Number(row.active) === 1,
  });
}

export class UserRepository {
  async findById(id: number, conn: DbConn = pool): Promise<User | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [id]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async findByUsername(username: string, conn: DbConn = pool): Promise<User | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE username = ?', [username]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async findByEmail(email: string, conn: DbConn = pool): Promise<User | null> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT * FROM users WHERE email = ?', [email]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async save(user: User, conn: DbConn = pool): Promise<User> {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO users (username, password_hash, full_name, role, student_code, phone, email, email_verified, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.username, user.passwordHash, user.fullName, user.role, user.studentCode, user.phone, user.email, user.emailVerified ? 1 : 0, user.active ? 1 : 0],
    );
    user.id = result.insertId;
    return user;
  }

  // UC03: không đổi username qua API sửa.
  async update(
    id: number,
    fields: { fullName?: string; studentCode?: string | null; phone?: string | null; active?: boolean; email?: string | null; emailVerified?: boolean; avatarUrl?: string | null },
    conn: DbConn = pool,
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.fullName !== undefined) { sets.push('full_name = ?'); params.push(fields.fullName); }
    if (fields.studentCode !== undefined) { sets.push('student_code = ?'); params.push(fields.studentCode); }
    if (fields.phone !== undefined) { sets.push('phone = ?'); params.push(fields.phone); }
    if (fields.email !== undefined) { sets.push('email = ?'); params.push(fields.email); }
    if (fields.emailVerified !== undefined) { sets.push('email_verified = ?'); params.push(fields.emailVerified ? 1 : 0); }
    if (fields.avatarUrl !== undefined) { sets.push('avatar_url = ?'); params.push(fields.avatarUrl); }
    if (fields.active !== undefined) { sets.push('active = ?'); params.push(fields.active ? 1 : 0); }
    if (sets.length === 0) return;
    params.push(id);
    await conn.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async delete(id: number, conn: DbConn = pool): Promise<void> {
    await conn.query('DELETE FROM users WHERE id = ?', [id]);
  }

  // Đổi mật khẩu (trang cá nhân): chỉ đổi password_hash, không dùng chung update().
  async updatePassword(id: number, passwordHash: string, conn: DbConn = pool): Promise<void> {
    await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  }

  async listReaders(
    keyword: string | undefined,
    page: number,
    limit: number,
    sort?: string,
    conn: DbConn = pool,
  ): Promise<{ users: User[]; total: number }> {
    const conditions = [`role = 'reader'`];
    const params: unknown[] = [];
    if (keyword) {
      conditions.push('(full_name LIKE ? OR username LIKE ? OR student_code LIKE ?)');
      const like = `%${keyword}%`;
      params.push(like, like, like);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    // recent_borrow: MySQL xếp NULL cuối khi DESC -> độc giả chưa từng mượn nằm cuối.
    const orderBy = resolveOrderBy(
      sort,
      {
        name_asc: 'full_name ASC, id DESC',
        recent_borrow: '(SELECT MAX(borrowed_at) FROM loans WHERE loans.reader_id = users.id) DESC, id DESC',
      },
      'id DESC',
    );
    const [countRows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM users ${where}`, params);
    const total = Number(countRows[0].total);
    const offset = (page - 1) * limit;
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM users ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return { users: rows.map(mapRow), total };
  }

  async listByRole(role: UserRole, sort?: string, conn: DbConn = pool): Promise<User[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM users WHERE role = ? ORDER BY ${userOrderBy(sort, 'id DESC')}`,
      [role],
    );
    return rows.map(mapRow);
  }

  /** Gộp nhiều role trong 1 query để sort xuyên suốt (dùng cho trang quản lý tài khoản). */
  async listByRoles(roles: UserRole[], sort?: string, conn: DbConn = pool): Promise<User[]> {
    if (roles.length === 0) return [];
    const placeholders = roles.map(() => '?').join(', ');
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM users WHERE role IN (${placeholders}) ORDER BY ${userOrderBy(sort, 'id DESC')}`,
      roles,
    );
    return rows.map(mapRow);
  }

  // D9: đếm số admin để cấm xóa admin cuối cùng.
  async countByRole(role: UserRole, conn: DbConn = pool): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM users WHERE role = ?', [role]);
    return Number(rows[0].total);
  }
}
