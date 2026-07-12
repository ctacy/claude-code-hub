#!/usr/bin/env node

/**
 * 迁移文件幂等性校验脚本
 *
 * 检查所有 Drizzle 迁移文件，确保：
 * 1. CREATE TABLE 使用 IF NOT EXISTS
 * 2. CREATE INDEX 使用 IF NOT EXISTS
 *
 * 防止迁移在重复执行或数据库状态不一致时失败
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 迁移文件目录
const MIGRATIONS_DIR = path.join(__dirname, "../drizzle");

// 豁免列表：历史迁移文件（在问题修复前已发布的版本）
// 这些文件虽然缺少 IF NOT EXISTS，但已在生产环境稳定运行
// 不建议修改以避免引入新问题
const EXEMPT_FILES = [
  "0000_legal_brother_voodoo.sql", // 初始迁移
  "0001_ambiguous_bromley.sql", // 历史迁移
  "0002_fancy_preak.sql", // 历史迁移
  "0003_outstanding_centennial.sql", // 历史迁移
  "0004_dazzling_starbolt.sql", // 历史迁移
  "0005_true_raza.sql", // 历史迁移
  "0006_lame_matthew_murdock.sql", // 历史迁移
  "0007_lazy_post.sql", // 历史迁移
  "0008_talented_molten_man.sql", // 历史迁移
  "0009_many_amazoness.sql", // 历史迁移
  "0010_unusual_bloodscream.sql", // 历史迁移
  "0011_charming_ben_parker.sql", // 历史迁移
  "0012_elite_iron_patriot.sql", // 历史迁移
  "0014_overconfident_mongu.sql", // 历史迁移（0013 已修复）
];

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

function info(message) {
  log(colors.blue, "[INFO]", message);
}

function warn(message) {
  log(colors.yellow, "[WARN]", message);
}

function error(message) {
  log(colors.red, "[ERROR]", message);
}

function success(message) {
  log(colors.green, "[SUCCESS]", message);
}

/**
 * 检查 SQL 文件的幂等性
 */
function validateMigrationFile(filePath) {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const issues = [];

  // 检查 CREATE TABLE 语句
  const createTableRegex = /CREATE\s+TABLE\s+"[^"]+"/gi;
  const createTableIfNotExistsRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"[^"]+"/gi;

  const createTables = content.match(createTableRegex) || [];
  const createTablesIfNotExists = content.match(createTableIfNotExistsRegex) || [];

  const missingIfNotExistsTables = createTables.length - createTablesIfNotExists.length;

  if (missingIfNotExistsTables > 0) {
    createTables.forEach((match) => {
      if (!/IF\s+NOT\s+EXISTS/i.test(match)) {
        const lineNumber = lines.findIndex((line) => line.includes(match.split('"')[1])) + 1;
        issues.push({
          type: "CREATE TABLE",
          line: lineNumber,
          statement: match,
          suggestion: match.replace(/CREATE\s+TABLE\s+/i, "CREATE TABLE IF NOT EXISTS "),
        });
      }
    });
  }

  // 检查 CREATE INDEX 语句
  const createIndexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+"[^"]+"/gi;
  const createIndexIfNotExistsRegex =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+"[^"]+"/gi;

  const createIndexes = content.match(createIndexRegex) || [];
  const createIndexesIfNotExists = content.match(createIndexIfNotExistsRegex) || [];

  const missingIfNotExistsIndexes = createIndexes.length - createIndexesIfNotExists.length;

  if (missingIfNotExistsIndexes > 0) {
    createIndexes.forEach((match) => {
      if (!/IF\s+NOT\s+EXISTS/i.test(match)) {
        const lineNumber = lines.findIndex((line) => line.includes(match)) + 1;
        issues.push({
          type: "CREATE INDEX",
          line: lineNumber,
          statement: match,
          suggestion: match.replace(
            /CREATE\s+(UNIQUE\s+)?INDEX\s+/i,
            "CREATE $1INDEX IF NOT EXISTS "
          ),
        });
      }
    });
  }

  return { fileName, issues };
}

/**
 * 校验 Drizzle journal 的时间戳单调性
 *
 * Drizzle PG migrator 仅通过 `created_at(folderMillis)` 与 DB 中最新一条迁移记录做比较来决定是否执行迁移：
 * - 若 journal 中 `when` 非严格递增，可能导致"后续迁移被永久跳过"（无感升级会漏执行）
 */
function validateJournalMonotonicity(journalPath) {
  const content = fs.readFileSync(journalPath, "utf-8");
  const journal = JSON.parse(content);

  if (!journal || !Array.isArray(journal.entries)) {
    return {
      fileName: path.basename(journalPath),
      issues: [
        {
          type: "JOURNAL",
          line: 0,
          statement: "Invalid journal format: entries[] is missing",
          suggestion: "Ensure drizzle/meta/_journal.json contains a valid { entries: [...] }",
        },
      ],
    };
  }

  const issues = [];
  let previousWhen = Number.NEGATIVE_INFINITY;
  let previousTag = "";

  for (const entry of journal.entries) {
    const tag = typeof entry?.tag === "string" ? entry.tag : "(unknown)";
    const when = entry?.when;
    if (typeof when !== "number" || !Number.isFinite(when)) {
      issues.push({
        type: "JOURNAL",
        line: 0,
        statement: `Invalid journal entry 'when' for tag=${tag}`,
        suggestion: "Ensure each journal entry has a numeric 'when' (folderMillis).",
      });
      continue;
    }

    if (when <= previousWhen) {
      issues.push({
        type: "JOURNAL",
        line: 0,
        statement: `Non-monotonic journal 'when': ${tag}(${when}) <= ${previousTag}(${previousWhen})`,
        suggestion: "Ensure journal entries' 'when' are strictly increasing in execution order.",
      });
    }

    previousWhen = when;
    previousTag = tag;
  }

  return { fileName: path.basename(journalPath), issues };
}

/**
 * 校验 fork 迁移不与上游既有 schema 冲突
 *
 * 规则：fork 迁移 (idx >= 10000) 不得在 SQL 中重复声明任何上游迁移 (idx < 10000) 中已存在的
 * 表名、列名或索引名（除非使用 IF NOT EXISTS 之类的幂等子句）。
 *
 * 背景：子代理/历史 bug `db:generate` 会基于错位快照重新生成上游已建对象的 CREATE/ALTER，
 * 导致生产数据库 "relation already exists" 启动崩溃（2026-07-12 事故）。
 */
function validateForkMigrationNoUpstreamCollision(journalPath) {
  const content = fs.readFileSync(journalPath, "utf-8");
  const journal = JSON.parse(content);
  if (!journal || !Array.isArray(journal.entries)) {
    return { fileName: path.basename(journalPath), issues: [] };
  }

  const metaDir = path.join(path.dirname(journalPath), "");
  const upstreamSnapshots = new Set();
  for (const entry of journal.entries) {
    if (typeof entry?.idx === "number" && entry.idx < 10000 && entry.tag) {
      const candidate = path.join(metaDir, `${entry.tag}_snapshot.json`);
      if (fs.existsSync(candidate)) upstreamSnapshots.add(candidate);
    }
  }

  const upstreamTableNames = new Set();
  const upstreamColumnRefs = new Set();
  for (const snapPath of upstreamSnapshots) {
    try {
      const snap = JSON.parse(fs.readFileSync(snapPath, "utf-8"));
      const tables = snap?.dialect === "postgresql"
        ? Object.values(snap?.tables ?? {})
        : [];
      for (const t of tables) {
        if (t?.name) upstreamTableNames.add(t.name);
        if (t?.schema && t?.name) {
          for (const col of Object.values(t.columns ?? {})) {
            if (col?.name) upstreamColumnRefs.add(`${t.name}.${col.name}`);
          }
        }
      }
    } catch {
      // skip malformed snapshot
    }
  }

  const issues = [];
  for (const entry of journal.entries) {
    if (typeof entry?.idx !== "number" || entry.idx < 10000) continue;
    if (!entry.tag) continue;
    const sqlPath = path.join(path.dirname(metaDir), `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, "utf-8");
    const lines = sql.split("\n");

    // 1) CREATE TABLE collision
    const createTableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi;
    let m;
    while ((m = createTableRe.exec(sql)) !== null) {
      const tableName = m[1];
      const hasIfNotExists = /IF\s+NOT\s+EXISTS/i.test(m[0]);
      if (upstreamTableNames.has(tableName) && !hasIfNotExists) {
        const lineNumber = lines.findIndex((line) => line.includes(m[0])) + 1;
        issues.push({
          type: "FORK_COLLISION",
          line: lineNumber,
          statement: `CREATE TABLE "${tableName}" duplicates upstream schema`,
          suggestion: `Remove the statement (upstream migration already created it) or use CREATE TABLE IF NOT EXISTS`,
        });
      }
    }

    // 2) ADD COLUMN collision
    const addColumnRe = /ALTER\s+TABLE\s+"([^"]+)"\s+ADD\s+COLUMN\s+"([^"]+)"/gi;
    while ((m = addColumnRe.exec(sql)) !== null) {
      const tableName = m[1];
      const columnName = m[2];
      if (upstreamColumnRefs.has(`${tableName}.${columnName}`)) {
        const lineNumber = lines.findIndex((line) => line.includes(m[0])) + 1;
        issues.push({
          type: "FORK_COLLISION",
          line: lineNumber,
          statement: `ADD COLUMN "${tableName}"."${columnName}" duplicates upstream schema`,
          suggestion: `Remove the statement (upstream migration already added this column)`,
        });
      }
    }

    // 3) CREATE INDEX collision: cannot easily detect unless we parse upstream indexes
    // Skip for now; covered by IF NOT EXISTS check above.
  }

  return {
    fileName: "Fork vs upstream schema collision",
    issues,
  };
}

/**
 * 主函数
 */
function main() {
  info("开始检查迁移文件的幂等性...\n");

  // 获取所有 .sql 迁移文件
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql") && /^\d{4}_/.test(file))
    .sort()
    .map((file) => path.join(MIGRATIONS_DIR, file));

  if (files.length === 0) {
    warn("未找到任何迁移文件");
    process.exit(0);
  }

  info(`找到 ${files.length} 个迁移文件\n`);

  let totalIssues = 0;
  const filesWithIssues = [];

  // 校验 meta/_journal.json 的单调性（避免漏迁移）
  const journalPath = path.join(MIGRATIONS_DIR, "meta/_journal.json");
  if (fs.existsSync(journalPath)) {
    const journalResult = validateJournalMonotonicity(journalPath);
    if (journalResult.issues.length > 0) {
      totalIssues += journalResult.issues.length;
      filesWithIssues.push(journalResult);
      error(`${journalResult.fileName} - 发现 ${journalResult.issues.length} 个问题:`);
      journalResult.issues.forEach((issue, index) => {
        console.log(`\n  ${index + 1}. ${issue.type}`);
        console.log(`     ${colors.red}✗${colors.reset} ${issue.statement}`);
        console.log(`     ${colors.green}✓${colors.reset} ${issue.suggestion}`);
      });
      console.log("");
    }

    // 校验 fork 迁移不与上游 schema 冲突
    const collisionResult = validateForkMigrationNoUpstreamCollision(journalPath);
    if (collisionResult.issues.length > 0) {
      totalIssues += collisionResult.issues.length;
      filesWithIssues.push(collisionResult);
      error(`${collisionResult.fileName} - 发现 ${collisionResult.issues.length} 个问题:`);
      collisionResult.issues.forEach((issue, index) => {
        console.log(`\n  ${index + 1}. ${issue.type} (第 ${issue.line} 行)`);
        console.log(`     ${colors.red}✗${colors.reset} ${issue.statement}`);
        console.log(`     ${colors.green}✓${colors.reset} ${issue.suggestion}`);
      });
      console.log("");
    }
  } else {
    warn("未找到 meta/_journal.json，无法校验迁移顺序与时间戳单调性");
  }

  // 检查每个文件
  files.forEach((filePath) => {
    const result = validateMigrationFile(filePath);
    const isExempt = EXEMPT_FILES.includes(result.fileName);

    if (result.issues.length > 0) {
      if (isExempt) {
        // 豁免文件：只显示警告，不计入失败
        warn(`${result.fileName} - 发现 ${result.issues.length} 个问题（已豁免）`);
        return;
      }

      totalIssues += result.issues.length;
      filesWithIssues.push(result);

      error(`${result.fileName} - 发现 ${result.issues.length} 个问题:`);
      result.issues.forEach((issue, index) => {
        console.log(`\n  ${index + 1}. ${issue.type} (第 ${issue.line} 行)`);
        console.log(`     ${colors.red}✗${colors.reset} ${issue.statement}`);
        console.log(`     ${colors.green}✓${colors.reset} ${issue.suggestion}`);
      });
      console.log("");
    }
  });

  // 输出总结
  console.log("─".repeat(60));
  if (totalIssues === 0) {
    success(`所有 ${files.length} 个迁移文件都通过了幂等性检查 ✓`);
    process.exit(0);
  } else {
    error(`检查完成: 发现 ${totalIssues} 个问题，涉及 ${filesWithIssues.length} 个文件`);
    console.log("");
    warn("建议修复上述问题以确保迁移的幂等性");
    warn("所有 CREATE TABLE 和 CREATE INDEX 语句都应该使用 IF NOT EXISTS");
    process.exit(1);
  }
}

// 执行
try {
  main();
} catch (err) {
  error(`脚本执行失败: ${err.message}`);
  console.error(err);
  process.exit(1);
}
