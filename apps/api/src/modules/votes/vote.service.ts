import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';

export class VoteService {
  async getAll(userId: string) {
    const result = await pool.query(
      `SELECT v.*,
              u.email AS "createdByEmail",
              m."fullName" AS "createdByName",
              (SELECT COUNT(*)::int FROM vote_responses WHERE "voteId" = v.id) AS "responseCount",
              (SELECT vr.response FROM vote_responses vr
               JOIN members mb ON mb.id = vr."memberId"
               WHERE vr."voteId" = v.id AND mb."userId" = $1
               LIMIT 1) AS "myResponse"
       FROM votes v
       LEFT JOIN users u ON u.id = v."createdBy"
       LEFT JOIN members m ON m."userId" = v."createdBy"
       ORDER BY v."createdAt" DESC`,
      [userId]
    );
    return result.rows;
  }

  async getById(id: string, userId: string) {
    const voteResult = await pool.query(
      `SELECT v.*,
              u.email AS "createdByEmail",
              m."fullName" AS "createdByName"
       FROM votes v
       LEFT JOIN users u ON u.id = v."createdBy"
       LEFT JOIN members m ON m."userId" = v."createdBy"
       WHERE v.id = $1`,
      [id]
    );
    const vote = voteResult.rows[0];
    if (!vote) throw new NotFoundError('Vote not found');

    const myResponseResult = await pool.query(
      `SELECT vr.response FROM vote_responses vr
       JOIN members mb ON mb.id = vr."memberId"
       WHERE vr."voteId" = $1 AND mb."userId" = $2
       LIMIT 1`,
      [id, userId]
    );
    const myResponse = myResponseResult.rows[0]?.response ?? null;

    if (vote.type === 'ANONYMOUS') {
      const optionsResult = await pool.query(
        `SELECT * FROM vote_options WHERE "voteId" = $1 ORDER BY "order"`,
        [id]
      );

      // Anonymous with custom options — return counts only, never voter names
      if (optionsResult.rows.length > 0) {
        const countsResult = await pool.query(
          `SELECT response, COUNT(*)::int AS count FROM vote_responses WHERE "voteId" = $1 GROUP BY response`,
          [id]
        );
        const countMap = Object.fromEntries(countsResult.rows.map((r) => [r.response, r.count]));
        const options = optionsResult.rows.map((opt) => ({
          ...opt,
          voteCount: countMap[opt.id] ?? 0,
        }));
        const totalResponses = countsResult.rows.reduce((s, r) => s + r.count, 0);
        return { ...vote, options, totalResponses, myResponse };
      }

      // Anonymous without options — classic like/dislike
      const countsResult = await pool.query(
        `SELECT response, COUNT(*)::int AS count FROM vote_responses WHERE "voteId" = $1 GROUP BY response`,
        [id]
      );
      const likes = countsResult.rows.find((r) => r.response === 'LIKE')?.count ?? 0;
      const dislikes = countsResult.rows.find((r) => r.response === 'DISLIKE')?.count ?? 0;
      return { ...vote, results: { likes, dislikes, total: likes + dislikes }, myResponse };
    } else {
      const optionsResult = await pool.query(
        `SELECT * FROM vote_options WHERE "voteId" = $1 ORDER BY "order"`,
        [id]
      );
      const responsesResult = await pool.query(
        `SELECT vr.response, vr."memberId", mb."fullName"
         FROM vote_responses vr
         JOIN members mb ON mb.id = vr."memberId"
         WHERE vr."voteId" = $1`,
        [id]
      );

      const options = optionsResult.rows.map((opt) => {
        const voters = responsesResult.rows.filter((r) => r.response === opt.id);
        return { ...opt, voteCount: voters.length, voters: voters.map((v) => ({ memberId: v.memberId, fullName: v.fullName })) };
      });

      return { ...vote, options, totalResponses: responsesResult.rows.length, myResponse };
    }
  }

  async create(data: {
    title: string;
    description?: string;
    type: string;
    startDate?: string;
    endDate?: string;
    options?: string[];
    createdBy: string;
  }) {
    if (!['ANONYMOUS', 'PUBLIC'].includes(data.type)) throw new BadRequestError('Invalid vote type');
    if (data.options && data.options.filter(Boolean).length > 0 && data.options.filter(Boolean).length < 2) {
      throw new BadRequestError('A poll must have at least 2 options');
    }
    if (data.type === 'PUBLIC' && (!data.options || data.options.filter(Boolean).length < 2)) {
      throw new BadRequestError('A public poll must have at least 2 options');
    }

    const voteId = uuidv4();
    const result = await pool.query(
      `INSERT INTO votes (id, title, description, type, status, "startDate", "endDate", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        voteId,
        data.title.trim(),
        data.description?.trim() || null,
        data.type,
        data.startDate ? new Date(data.startDate) : null,
        data.endDate ? new Date(data.endDate) : null,
        data.createdBy,
      ]
    );

    if (data.options) {
      const filtered = data.options.map((o) => o.trim()).filter(Boolean);
      for (let i = 0; i < filtered.length; i++) {
        await pool.query(
          `INSERT INTO vote_options (id, "voteId", label, "order", "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
          [uuidv4(), voteId, filtered[i], i]
        );
      }
    }

    return result.rows[0];
  }

  async setStatus(id: string, status: string, userId: string) {
    const existing = await pool.query('SELECT * FROM votes WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Vote not found');

    const vote = existing.rows[0];
    const valid: Record<string, string[]> = { DRAFT: ['ACTIVE'], ACTIVE: ['CLOSED'], CLOSED: [] };
    if (!valid[vote.status]?.includes(status)) {
      throw new BadRequestError(`Cannot change status from ${vote.status} to ${status}`);
    }

    let query = `UPDATE votes SET status = $1, "updatedAt" = NOW()`;
    const params: any[] = [status];

    if (status === 'CLOSED') {
      query += `, "closedBy" = $2, "closedAt" = NOW()`;
      params.push(userId);
    }

    params.push(id);
    const result = await pool.query(`${query} WHERE id = $${params.length} RETURNING *`, params);
    return result.rows[0];
  }

  async respond(voteId: string, userId: string, response: string) {
    const voteResult = await pool.query('SELECT * FROM votes WHERE id = $1', [voteId]);
    if (!voteResult.rows[0]) throw new NotFoundError('Vote not found');
    const vote = voteResult.rows[0];
    if (vote.status !== 'ACTIVE') throw new BadRequestError('This vote is not currently active');

    const memberResult = await pool.query('SELECT id FROM members WHERE "userId" = $1', [userId]);
    if (!memberResult.rows[0]) throw new BadRequestError('Only members can cast votes');
    const memberId = memberResult.rows[0].id;

    const optionCountResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM vote_options WHERE "voteId" = $1',
      [voteId]
    );
    const hasOptions = optionCountResult.rows[0].count > 0;

    if (hasOptions) {
      const optionResult = await pool.query(
        'SELECT id FROM vote_options WHERE id = $1 AND "voteId" = $2',
        [response, voteId]
      );
      if (!optionResult.rows[0]) throw new BadRequestError('Invalid option');
    } else {
      if (!['LIKE', 'DISLIKE'].includes(response)) throw new BadRequestError('Response must be LIKE or DISLIKE');
    }

    await pool.query(
      `INSERT INTO vote_responses (id, "voteId", "memberId", response, "createdAt")
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ("voteId", "memberId") DO UPDATE SET response = EXCLUDED.response`,
      [uuidv4(), voteId, memberId, response]
    );

    return { message: 'Vote recorded' };
  }

  async removeResponse(voteId: string, userId: string) {
    const memberResult = await pool.query('SELECT id FROM members WHERE "userId" = $1', [userId]);
    if (!memberResult.rows[0]) throw new BadRequestError('Only members can remove votes');
    await pool.query(
      'DELETE FROM vote_responses WHERE "voteId" = $1 AND "memberId" = $2',
      [voteId, memberResult.rows[0].id]
    );
    return { message: 'Vote removed' };
  }

  async delete(id: string) {
    const existing = await pool.query('SELECT id FROM votes WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Vote not found');
    await pool.query('DELETE FROM votes WHERE id = $1', [id]);
    return { message: 'Vote deleted' };
  }
}
