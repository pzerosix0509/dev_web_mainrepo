import { createServer } from 'http';
import { app } from '../backend/src/app.ts';
import { prisma } from '../backend/src/config/prisma.ts';
import fs from 'fs';
import path from 'path';

// --- Helper Functions for Trigram & ILIKE simulation ---
function getTrigrams(str) {
  const padded = `  ${str.toLowerCase()}  `;
  const trigrams = new Set();
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }
  return trigrams;
}

function calcSimilarity(str1, str2) {
  const t1 = getTrigrams(str1);
  const t2 = getTrigrams(str2);
  let intersection = 0;
  for (const t of t1) {
    if (t2.has(t)) intersection++;
  }
  const union = t1.size + t2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ilikeEscapeToRegex(pattern) {
  let regexStr = '^';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '!' && i + 1 < pattern.length) {
      regexStr += escapeRegex(pattern[i + 1]);
      i++;
    } else if (pattern[i] === '%') {
      regexStr += '.*';
    } else if (pattern[i] === '_') {
      regexStr += '.';
    } else {
      regexStr += escapeRegex(pattern[i]);
    }
  }
  regexStr += '$';
  return new RegExp(regexStr, 'i');
}

// --- In-Memory Fixtures (Mirroring Slide 23 and Block 6) ---
let chefSeq = 3;
let ingSeq = 3;
let dishSeq = 7;

let chefs = [
  { id: 1, name: 'Trần Thị Kim Mai', specialty: 'Món Việt', dishes: [{ id: 1, name: 'PostgreSQL guide' }] },
  { id: 2, name: 'Phạm Minh Quân', specialty: 'Món Âu', dishes: [{ id: 2, name: 'SQL for beginners' }] }
];

let ingredients = [
  { id: 1, name: 'Rau thơm hữu cơ', unit: 'bó', dishes: [{ dishId: 1 }] },
  { id: 2, name: 'Thịt bò Wagyu', unit: 'gram', dishes: [] }
];

// Fixture books/dishes matching Slide 23
let dishes = [
  { id: 1, name: 'PostgreSQL guide', description: 'Comprehensive guide to relational database systems', price: 120000, category: 'database', available: true, chefId: 1 },
  { id: 2, name: 'SQL for beginners', description: 'Learn basic SQL queries and database design', price: 80000, category: 'database', available: false, chefId: 2 },
  { id: 4, name: 'Cats and rats', description: 'Fun adventures of cats and rats in modern kitchen', price: 60000, category: 'fiction', available: true, chefId: 1 },
  { id: 5, name: 'Running with cats', description: 'Exciting outdoor stories and delicious recipes', price: 70000, category: 'fiction', available: true, chefId: 1 },
  { id: 6, name: '100% SQL_notes', description: 'Advanced query tuning with 100% guarantee notes', price: 0, category: 'database', available: false, chefId: 2 },
  { id: 7, name: 'Postgres guide', description: 'Quick tutorial to postgres server administration', price: 110000, category: 'database', available: true, chefId: 2 }
];

let dishIngredients = [
  { dishId: 1, ingredientId: 1 },
  { dishId: 2, ingredientId: 2 },
  { dishId: 6, ingredientId: 1 }
];

function populateDish(d) {
  const chef = chefs.find((c) => c.id === d.chefId);
  const ings = dishIngredients
    .filter((di) => di.dishId === d.id)
    .map((di) => {
      const ing = ingredients.find((i) => i.id === di.ingredientId);
      return { dishId: d.id, ingredientId: di.ingredientId, ingredient: ing ? { ...ing } : null };
    });
  return {
    ...d,
    chef: chef ? { id: chef.id, name: chef.name, specialty: chef.specialty } : null,
    ingredients: ings
  };
}

// --- Attach Mocks to Prisma ---
prisma.$transaction = async (fn) => fn(prisma);

// Mock $queryRaw to evaluate queries on dishes in-memory
prisma.$queryRaw = async (queryObj) => {
  const sqlText = queryObj.sql || queryObj.text || '';
  const values = queryObj.values || [];

  // Parse filters by pairing each parameter with its preceding SQL fragment
  let filtered = [...dishes];
  const parts = sqlText.split('?');

  for (let i = 0; i < values.length && i < parts.length - 1; i++) {
    const val = values[i];
    const prevText = parts[i];
    if (prevText.includes('"category" =')) {
      filtered = filtered.filter((d) => d.category === val);
    } else if (prevText.includes('"price" >=')) {
      filtered = filtered.filter((d) => d.price >= val);
    } else if (prevText.includes('"price" <=')) {
      filtered = filtered.filter((d) => d.price <= val);
    } else if (prevText.includes('"available" =')) {
      filtered = filtered.filter((d) => d.available === val);
    } else if (prevText.includes('ILIKE')) {
      const regex = ilikeEscapeToRegex(val);
      filtered = filtered.filter((d) => regex.test(d.name));
    } else if (prevText.includes('plainto_tsquery')) {
      const keywords = String(val).toLowerCase().split(/\s+/).filter(Boolean);
      filtered = filtered
        .map((d) => {
          const doc = `${d.name} ${d.description || ''}`.toLowerCase();
          const matchCount = keywords.filter((k) => doc.includes(k)).length;
          return { ...d, _rank: matchCount };
        })
        .filter((d) => d._rank > 0)
        .sort((a, b) => b._rank - a._rank || a.id - b.id);
    } else if (prevText.includes('similarity')) {
      filtered = filtered
        .map((d) => ({
          ...d,
          _sim: calcSimilarity(d.name, String(val))
        }))
        .filter((d) => d._sim >= 0.3)
        .sort((a, b) => b._sim - a._sim || a.id - b.id);
    }
  }

  // Handle COUNT
  if (sqlText.includes('COUNT(*)')) {
    return [{ count: filtered.length }];
  }

  // Handle SELECT "id" with LIMIT and OFFSET
  let result = filtered;
  const limit = values[values.length - 2];
  const offset = values[values.length - 1];

  if (typeof limit === 'number' && typeof offset === 'number') {
    result = result.slice(offset, offset + limit);
  }

  return result.map((d) => ({ id: d.id }));
};

prisma.dish = {
  findMany: async (args = {}) => {
    let result = dishes.map(populateDish);
    if (args.where?.id?.in) {
      result = result.filter((d) => args.where.id.in.includes(d.id));
    }
    return result;
  },
  findUnique: async ({ where }) => {
    const d = dishes.find((item) => item.id === where.id);
    return d ? populateDish(d) : null;
  },
  create: async ({ data }) => {
    const id = ++dishSeq;
    const newDish = {
      id,
      name: data.name,
      description: data.description ?? '',
      price: data.price,
      category: data.category,
      available: data.available ?? true,
      chefId: data.chefId
    };
    dishes.push(newDish);
    if (data.ingredients?.create) {
      for (const item of data.ingredients.create) {
        dishIngredients.push({ dishId: id, ingredientId: item.ingredientId });
      }
    }
    return populateDish(newDish);
  },
  update: async ({ where, data }) => {
    const idx = dishes.findIndex((d) => d.id === where.id);
    if (idx === -1) return null;
    dishes[idx] = {
      ...dishes[idx],
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.available !== undefined ? { available: data.available } : {}),
      ...(data.chefId !== undefined ? { chefId: data.chefId } : {})
    };
    if (data.ingredients?.create) {
      dishIngredients = dishIngredients.filter((di) => di.dishId !== where.id);
      for (const item of data.ingredients.create) {
        dishIngredients.push({ dishId: where.id, ingredientId: item.ingredientId });
      }
    }
    return populateDish(dishes[idx]);
  },
  delete: async ({ where }) => {
    const idx = dishes.findIndex((d) => d.id === where.id);
    if (idx === -1) return null;
    const deleted = dishes.splice(idx, 1)[0];
    dishIngredients = dishIngredients.filter((di) => di.dishId !== where.id);
    return deleted;
  },
  count: async () => dishes.length
};

prisma.chef = {
  findMany: async () =>
    chefs.map((c) => ({
      ...c,
      _count: { dishes: dishes.filter((d) => d.chefId === c.id).length }
    })),
  findUnique: async ({ where }) => {
    const c = chefs.find((chef) => chef.id === where.id);
    if (!c) return null;
    return {
      ...c,
      dishes: dishes.filter((d) => d.chefId === c.id).map((d) => ({ id: d.id, name: d.name }))
    };
  },
  create: async ({ data }) => {
    const id = ++chefSeq;
    const newChef = { id, name: data.name, specialty: data.specialty };
    chefs.push(newChef);
    return newChef;
  },
  update: async ({ where, data }) => {
    const idx = chefs.findIndex((c) => c.id === where.id);
    if (idx === -1) return null;
    chefs[idx] = { ...chefs[idx], ...data };
    return chefs[idx];
  },
  delete: async ({ where }) => {
    const count = dishes.filter((d) => d.chefId === where.id).length;
    if (count > 0) return null;
    const idx = chefs.findIndex((c) => c.id === where.id);
    if (idx === -1) return null;
    return chefs.splice(idx, 1)[0];
  },
  count: async () => chefs.length
};

prisma.ingredient = {
  findMany: async (args = {}) => {
    if (args.where?.id?.in) {
      return ingredients.filter((i) => args.where.id.in.includes(i.id));
    }
    return ingredients.map((i) => ({
      ...i,
      _count: { dishes: dishIngredients.filter((di) => di.ingredientId === i.id).length }
    }));
  },
  findUnique: async ({ where }) => {
    const i = ingredients.find((item) => item.id === where.id);
    if (!i) return null;
    return {
      ...i,
      dishes: dishIngredients.filter((di) => di.ingredientId === i.id)
    };
  },
  create: async ({ data }) => {
    const id = ++ingSeq;
    const newIng = { id, name: data.name, unit: data.unit };
    ingredients.push(newIng);
    return newIng;
  },
  update: async ({ where, data }) => {
    const idx = ingredients.findIndex((i) => i.id === where.id);
    if (idx === -1) return null;
    ingredients[idx] = { ...ingredients[idx], ...data };
    return ingredients[idx];
  },
  delete: async ({ where }) => {
    const count = dishIngredients.filter((di) => di.ingredientId === where.id).length;
    if (count > 0) return null;
    const idx = ingredients.findIndex((i) => i.id === where.id);
    if (idx === -1) return null;
    return ingredients.splice(idx, 1)[0];
  },
  count: async () => ingredients.length
};

prisma.dishIngredient = {
  deleteMany: async ({ where }) => {
    if (where?.dishId) {
      dishIngredients = dishIngredients.filter((di) => di.dishId !== where.dishId);
    }
    return { count: 1 };
  },
  count: async ({ where }) => {
    if (where?.ingredientId) {
      return dishIngredients.filter((di) => di.ingredientId === where.ingredientId).length;
    }
    return dishIngredients.length;
  }
};

// --- Test Runner ---
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function main() {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`\n============================================================`);
  console.log(`  BỘ KIỂM THỬ TỰ ĐỘNG BLOCK #7 (SEARCH & PAGINATION SUITE)`);
  console.log(`  Target: ${baseUrl}`);
  console.log(`============================================================\n`);

  try {
    // Test 1: CORS & Preflight OPTIONS 204
    await runTest('Test 01: CORS & Preflight OPTIONS (204 No Content, CORS Headers)', async () => {
      const preflight = await fetch(`${baseUrl}/api/dishes`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
      assert(preflight.status === 204, `Preflight status expected 204, got ${preflight.status}`);
      assert(preflight.headers.get('access-control-allow-origin') === 'http://localhost:5173', 'CORS Origin mismatch');
    });

    // Test 2: 404 & 400 Technical Errors
    await runTest('Test 02: Lỗi kỹ thuật 404 & 400 không chứa trường "ok"', async () => {
      const res404 = await fetch(`${baseUrl}/api/unknown-route`);
      assert(res404.status === 404, `Expected 404, got ${res404.status}`);
      const json404 = await res404.json();
      assert(json404.ok === undefined, '404 response must NOT contain "ok"');

      const res400 = await fetch(`${baseUrl}/api/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid_json'
      });
      assert(res400.status === 400, `Expected 400, got ${res400.status}`);
      const json400 = await res400.json();
      assert(json400.ok === undefined, '400 response must NOT contain "ok"');
    });

    // Test 3: Pagination response format { items, total, page, pageSize }
    await runTest('Test 03: GET /api/dishes trả về cấu trúc phân trang { items, total, page, pageSize }', async () => {
      const res = await fetch(`${baseUrl}/api/dishes?page=1&pageSize=3`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const json = await res.json();
      assert(json.ok === true, 'Expected ok: true');
      assert(json.data.items && Array.isArray(json.data.items), 'Expected items array');
      assert(json.data.items.length === 3, `Expected 3 items, got ${json.data.items.length}`);
      assert(json.data.total === 6, `Expected total 6, got ${json.data.total}`);
      assert(json.data.page === 1, `Expected page 1, got ${json.data.page}`);
      assert(json.data.pageSize === 3, `Expected pageSize 3, got ${json.data.pageSize}`);
      assert(json.data.items[0].chef !== undefined, 'Item must include chef');
      assert(Array.isArray(json.data.items[0].ingredients), 'Item must include ingredients array');
    });

    // Test 4: Trang vượt phạm vi trả items: [] (Slide 9 & 10)
    await runTest('Test 04: Trang vượt phạm vi (page=99) hợp lệ và trả items: [], total không đổi', async () => {
      const res = await fetch(`${baseUrl}/api/dishes?page=99&pageSize=10`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const json = await res.json();
      assert(json.ok === true, 'Expected ok: true');
      assert(Array.isArray(json.data.items) && json.data.items.length === 0, 'Expected items: []');
      assert(json.data.total === 6, `Expected total 6, got ${json.data.total}`);
      assert(json.data.page === 99, 'Expected page: 99');
    });

    // Test 5: Validation failed query params (Slide 10 & 27)
    await runTest('Test 05: Validation query parameters (HTTP 200, VALIDATION_FAILED)', async () => {
      // page invalid
      const res1 = await fetch(`${baseUrl}/api/dishes?page=0`);
      const json1 = await res1.json();
      assert(json1.ok === false && json1.error?.code === 'VALIDATION_FAILED', 'Expected VALIDATION_FAILED for page=0');
      assert(json1.error?.fields?.page, 'Expected error in fields.page');

      // pageSize > 100
      const res2 = await fetch(`${baseUrl}/api/dishes?pageSize=101`);
      const json2 = await res2.json();
      assert(json2.ok === false && json2.error?.code === 'VALIDATION_FAILED', 'Expected VALIDATION_FAILED for pageSize=101');
      assert(json2.error?.fields?.pageSize, 'Expected error in fields.pageSize');

      // minPrice > maxPrice
      const res3 = await fetch(`${baseUrl}/api/dishes?minPrice=50000&maxPrice=10000`);
      const json3 = await res3.json();
      assert(json3.ok === false && json3.error?.code === 'VALIDATION_FAILED', 'Expected VALIDATION_FAILED for minPrice > maxPrice');
      assert(json3.error?.fields?.maxPrice, 'Expected error in fields.maxPrice');

      // available lạ
      const res4 = await fetch(`${baseUrl}/api/dishes?available=yes`);
      const json4 = await res4.json();
      assert(json4.ok === false && json4.error?.code === 'VALIDATION_FAILED', 'Expected VALIDATION_FAILED for available=yes');

      // mode không hợp lệ
      const res5 = await fetch(`${baseUrl}/api/dishes?mode=unknown`);
      const json5 = await res5.json();
      assert(json5.ok === false && json5.error?.code === 'VALIDATION_FAILED', 'Expected VALIDATION_FAILED for mode=unknown');
    });

    // Test 6: Biên hợp lệ minPrice=0 và available=false (Slide 27)
    await runTest('Test 06: Biên minPrice=0 và available=false được tôn trọng, không bị bỏ qua', async () => {
      const res = await fetch(`${baseUrl}/api/dishes?available=false`);
      const json = await res.json();
      assert(json.ok === true, 'Expected ok: true');
      assert(json.data.total === 2, `Expected 2 unavailable dishes, got ${json.data.total}`);
      assert(json.data.items.every((d) => d.available === false), 'All items must have available: false');

      const resPrice = await fetch(`${baseUrl}/api/dishes?minPrice=0&maxPrice=60000`);
      const jsonPrice = await resPrice.json();
      assert(jsonPrice.ok === true, 'Expected ok: true');
      assert(jsonPrice.data.items.every((d) => d.price >= 0 && d.price <= 60000), 'All items must be within 0 - 60,000');
    });

    // Test 7: Ký tự đặc biệt (100%, SQL_, !) được escape chuẩn xác (Slide 25)
    await runTest('Test 07: Ký tự đặc biệt (100%, SQL_, !) không mở rộng phạm vi tìm kiếm', async () => {
      // Tìm "100%"
      const res100 = await fetch(`${baseUrl}/api/dishes?mode=basic&q=100%`);
      const json100 = await res100.json();
      assert(json100.ok === true, 'Expected ok: true');
      assert(json100.data.total === 1, `Expected 1 dish matching "100%", got ${json100.data.total}`);
      assert(json100.data.items[0].name.includes('100%'), 'Matched item must include "100%"');

      // Tìm "SQL_"
      const resSql = await fetch(`${baseUrl}/api/dishes?mode=basic&q=SQL_`);
      const jsonSql = await resSql.json();
      assert(jsonSql.ok === true, 'Expected ok: true');
      assert(jsonSql.data.total === 1, `Expected 1 dish matching "SQL_", got ${jsonSql.data.total}`);
      assert(jsonSql.data.items[0].name.includes('SQL_'), 'Matched item must include "SQL_"');

      // Tìm chuỗi không khớp phải trả danh sách rỗng, không trả toàn bộ sách (Slide 25)
      const resNone = await fetch(`${baseUrl}/api/dishes?mode=basic&q=nonexistent_xyz`);
      const jsonNone = await resNone.json();
      assert(jsonNone.ok === true, 'Expected ok: true');
      assert(jsonNone.data.total === 0 && jsonNone.data.items.length === 0, 'Expected empty list for non-matching query');
    });

    // Test 8: Tính tương đương của basic và advanced khi chỉ có q (Slide 29)
    await runTest('Test 08: Basic và Advanced cho cùng kết quả khi chỉ có cùng q', async () => {
      const basicRes = await fetch(`${baseUrl}/api/dishes?mode=basic&q=guide`);
      const basicJson = await basicRes.json();

      const advRes = await fetch(`${baseUrl}/api/dishes?mode=advanced&q=guide`);
      const advJson = await advRes.json();

      assert(basicJson.data.total === advJson.data.total, 'Totals must be identical');
      assert(basicJson.data.items.length === advJson.data.items.length, 'Item counts must match');
      const basicIds = basicJson.data.items.map((d) => d.id);
      const advIds = advJson.data.items.map((d) => d.id);
      assert(JSON.stringify(basicIds) === JSON.stringify(advIds), 'IDs order must match identically');
    });

    // Test 9: Fulltext Search & Fuzzy Search ranking (Slide 37 & 38)
    await runTest('Test 09: Full-text Search và Fuzzy Search với ranking điểm giảm dần', async () => {
      // Fulltext
      const ftsRes = await fetch(`${baseUrl}/api/dishes?mode=fulltext&q=relational`);
      const ftsJson = await ftsRes.json();
      assert(ftsJson.ok === true, 'Expected ok: true for fulltext');
      assert(ftsJson.data.total >= 1, 'Expected at least 1 match in fulltext');
      assert(ftsJson.data.items[0].id === 1, 'Expected dish #1 matched via description');

      // Fuzzy: tìm "Postgre" gần giống "PostgreSQL guide" & "Postgres guide"
      const fuzzyRes = await fetch(`${baseUrl}/api/dishes?mode=fuzzy&q=Postgre`);
      const fuzzyJson = await fuzzyRes.json();
      assert(fuzzyJson.ok === true, 'Expected ok: true for fuzzy');
      assert(fuzzyJson.data.total >= 2, 'Expected matches for fuzzy "Postgre"');
    });

    // Test 10: GET /api/dishes/:id & NOT_FOUND
    await runTest('Test 10: GET /api/dishes/:id chi tiết & NOT_FOUND', async () => {
      const res = await fetch(`${baseUrl}/api/dishes/1`);
      const json = await res.json();
      assert(json.ok === true && json.data.id === 1, 'Expected dish id 1');

      const res404 = await fetch(`${baseUrl}/api/dishes/99999`);
      const json404 = await res404.json();
      assert(json404.ok === false && json404.error.code === 'NOT_FOUND', 'Expected NOT_FOUND');
    });

    // Test 11: POST /api/dishes tạo mới & VALIDATION_FAILED
    let createdDishId = null;
    await runTest('Test 11: POST /api/dishes tạo mới & VALIDATION_FAILED', async () => {
      const postRes = await fetch(`${baseUrl}/api/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bún Bò Huế Cố Đô',
          price: 55000,
          category: 'Món nước',
          chefId: 1,
          ingredientIds: [1, 2]
        })
      });
      const postJson = await postRes.json();
      assert(postJson.ok === true, 'Expected ok: true on creation');
      createdDishId = postJson.data.id;

      // Price string rejection
      const badRes = await fetch(`${baseUrl}/api/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Phở', price: '50000', category: 'Món nước', chefId: 1 })
      });
      const badJson = await badRes.json();
      assert(badJson.ok === false && badJson.error.code === 'VALIDATION_FAILED', 'Expected VALIDATION_FAILED for string price');
    });

    // Test 12: PATCH & DELETE /api/dishes/:id
    await runTest('Test 12: PATCH cập nhật & DELETE xóa món ăn', async () => {
      const patchRes = await fetch(`${baseUrl}/api/dishes/${createdDishId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bún Bò Huế Đặc Biệt', price: 65000 })
      });
      const patchJson = await patchRes.json();
      assert(patchJson.ok === true && patchJson.data.name === 'Bún Bò Huế Đặc Biệt', 'Expected name updated');

      const delRes = await fetch(`${baseUrl}/api/dishes/${createdDishId}`, { method: 'DELETE' });
      const delJson = await delRes.json();
      assert(delJson.ok === true, 'Expected delete ok: true');
    });

    // Test 13: CRUD /api/chefs
    await runTest('Test 13: CRUD /api/chefs', async () => {
      const listRes = await fetch(`${baseUrl}/api/chefs`);
      const listJson = await listRes.json();
      assert(listJson.ok === true && Array.isArray(listJson.data), 'Expected chefs list');

      const postRes = await fetch(`${baseUrl}/api/chefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Gordon Ramsay', specialty: 'Món Âu' })
      });
      const postJson = await postRes.json();
      assert(postJson.ok === true && postJson.data.id > 0, 'Expected chef created');
    });

    // Test 14: CRUD /api/ingredients
    await runTest('Test 14: CRUD /api/ingredients', async () => {
      const listRes = await fetch(`${baseUrl}/api/ingredients`);
      const listJson = await listRes.json();
      assert(listJson.ok === true && Array.isArray(listJson.data), 'Expected ingredients list');

      const postRes = await fetch(`${baseUrl}/api/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hạt tiêu Phú Quốc', unit: 'gam' })
      });
      const postJson = await postRes.json();
      assert(postJson.ok === true && postJson.data.id > 0, 'Expected ingredient created');
    });

    // Test 15: SPA Security & Deep link checks
    await runTest('Test 15: SPA Security Checks (no secrets leak)', async () => {
      const indexPath = path.resolve('frontend/index.html');
      assert(fs.existsSync(indexPath), 'frontend/index.html must exist');
      const content = fs.readFileSync(indexPath, 'utf-8');
      assert(!content.includes('DATABASE_URL'), 'index.html must not contain DATABASE_URL');
      assert(!content.includes('postgres'), 'index.html must not contain postgres credentials');
    });

  } finally {
    server.close();
  }

  console.log(`\n------------------------------------------------------------`);
  console.log(`  KẾT QUẢ KIỂM THỬ BLOCK #7: ${passed} PASS, ${failed} FAIL`);
  console.log(`------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
