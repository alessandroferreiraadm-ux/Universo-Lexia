/**
 * Avatar Analytics Routes - Endpoints para rastrear cliques em Alice/LIA
 */

import { Router } from "express";
import { ChatAnalyticsDB } from "./chat-analytics-db";

const router = Router();
const db = new ChatAnalyticsDB();

/**
 * POST /api/analytics/avatar-click
 * Rastrear clique em Alice ou LIA
 */
router.post("/avatar-click", async (req, res) => {
  try {
    const { type, timestamp, page, userAgent, referrer } = req.body;

    if (!type || !["alice", "lia"].includes(type)) {
      return res.status(400).json({ error: "Invalid avatar type" });
    }

    // Salvar no banco de dados
    const query = `
      INSERT INTO chat_interactions (
        session_id,
        timestamp,
        event_type,
        element_text,
        element_type,
        page_url,
        metadata
      ) VALUES (
        NULL,
        FROM_UNIXTIME(?/1000),
        ?,
        ?,
        'avatar_button',
        ?,
        ?
      )
    `;

    const metadata = JSON.stringify({
      type,
      userAgent,
      referrer,
      timestamp,
    });

    await db.query(query, [
      timestamp,
      `avatar_${type}_click`,
      type === "alice" ? "Contrate com Alice" : "Dúvidas com LIA",
      page,
      metadata,
    ]);

    res.json({ success: true, type });
  } catch (error) {
    console.error("Avatar click tracking error:", error);
    res.status(500).json({ error: "Failed to track avatar click" });
  }
});

/**
 * GET /api/analytics/avatar-stats
 * Obter estatísticas de cliques em Alice/LIA
 */
router.get("/avatar-stats", async (req, res) => {
  try {
    const period = req.query.period || "7"; // Dias (padrão: 7)

    const query = `
      SELECT
        JSON_EXTRACT(metadata, '$.type') as avatar_type,
        COUNT(*) as clicks,
        COUNT(DISTINCT DATE(timestamp)) as days_with_clicks,
        MAX(timestamp) as last_click,
        JSON_EXTRACT(metadata, '$.userAgent') as top_user_agent
      FROM chat_interactions
      WHERE
        event_type = 'avatar_alice_click'
        OR event_type = 'avatar_lia_click'
        AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY avatar_type
      ORDER BY clicks DESC
    `;

    const stats = await db.query(query, [period]);

    // Calcular taxa de cliques por página
    const pageQuery = `
      SELECT
        page_url,
        JSON_EXTRACT(metadata, '$.type') as avatar_type,
        COUNT(*) as clicks
      FROM chat_interactions
      WHERE
        (event_type = 'avatar_alice_click' OR event_type = 'avatar_lia_click')
        AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY page_url, avatar_type
      ORDER BY clicks DESC
      LIMIT 10
    `;

    const pageStats = await db.query(pageQuery, [period]);

    // Calcular taxa de conversão (cliques em Alice vs LIA)
    const aliceClicks =
      stats.find((s: any) => s.avatar_type === '"alice"')?.clicks || 0;
    const liaClicks =
      stats.find((s: any) => s.avatar_type === '"lia"')?.clicks || 0;
    const totalClicks = aliceClicks + liaClicks;
    const conversionRate =
      totalClicks > 0
        ? {
            alice: ((aliceClicks / totalClicks) * 100).toFixed(2) + "%",
            lia: ((liaClicks / totalClicks) * 100).toFixed(2) + "%",
          }
        : { alice: "0%", lia: "0%" };

    res.json({
      period: `${period} days`,
      summary: {
        totalClicks,
        aliceClicks,
        liaClicks,
        conversionRate,
      },
      byAvatar: stats,
      byPage: pageStats,
    });
  } catch (error) {
    console.error("Avatar stats error:", error);
    res.status(500).json({ error: "Failed to fetch avatar stats" });
  }
});

/**
 * GET /api/analytics/avatar-timeline
 * Obter timeline de cliques em Alice/LIA
 */
router.get("/avatar-timeline", async (req, res) => {
  try {
    const query = `
      SELECT
        DATE(timestamp) as date,
        HOUR(timestamp) as hour,
        JSON_EXTRACT(metadata, '$.type') as avatar_type,
        COUNT(*) as clicks
      FROM chat_interactions
      WHERE
        (event_type = 'avatar_alice_click' OR event_type = 'avatar_lia_click')
        AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(timestamp), HOUR(timestamp), avatar_type
      ORDER BY timestamp DESC
    `;

    const timeline = await db.query(query, []);

    res.json({ timeline });
  } catch (error) {
    console.error("Avatar timeline error:", error);
    res.status(500).json({ error: "Failed to fetch avatar timeline" });
  }
});

/**
 * GET /api/analytics/avatar-heatmap
 * Heatmap de cliques por hora e dia da semana
 */
router.get("/avatar-heatmap", async (req, res) => {
  try {
    const query = `
      SELECT
        DAYNAME(timestamp) as day_name,
        DAYOFWEEK(timestamp) as day_of_week,
        HOUR(timestamp) as hour,
        JSON_EXTRACT(metadata, '$.type') as avatar_type,
        COUNT(*) as clicks
      FROM chat_interactions
      WHERE
        (event_type = 'avatar_alice_click' OR event_type = 'avatar_lia_click')
        AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY day_of_week, hour, avatar_type
      ORDER BY day_of_week, hour
    `;

    const heatmap = await db.query(query, []);

    res.json({ heatmap });
  } catch (error) {
    console.error("Avatar heatmap error:", error);
    res.status(500).json({ error: "Failed to fetch avatar heatmap" });
  }
});

export default router;
