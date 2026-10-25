import { createServer } from 'http';
import { app } from '../backend/src/app.ts';
import { prisma } from '../backend/src/config/prisma.ts';
import fs from 'fs';
import path from 'path';

// --- In-memory mock database for deterministic automated testing ---
let chefSeq = 2;
let ingSeq = 3;
let dishSeq = 2;

let chefs = [
  { id: 1, name: 'Trần Thị Kim Mai', specialty: 'Món Việt', dishes: [{ id: 1, name: 'Phở Bò Tái Lăn Hà Nội' }] }
];

let ingredients = [
  { id: 1, name: 'Rau thơm hữu cơ', unit: 'bó', dishes: [{ dishId: 1 }] },
  { id: 2, name: 'Thịt bò Wagyu', unit: 'gram', dishes: [] }
];

let dishes = [
  {
    id: 1,
    name: 'Phở Bò Tái Lăn Hà Nội',
    description: 'Nước dùng thanh ngọt, thịt bò xào lăn thơm lừng',
    price: 65000,
    category: 'Món nước',
    available: true,
    chefId: 1
  }
];

let dishIngredients = [
  { dishId: 1, ingredientId: 1 }
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

// Attach mocks to prisma
prisma.$transaction = async (fn) => fn(prisma);

prisma.dish = {
  findMany: async (args = {}) => {
    let result = dishes.map(populateDish);
    if (args.where?.OR) {
      const q = args.where.OR[0].name.contains.toLowerCase();
      result = result.filter(
        (d) => d.name.toLowerCase().includes(q) || (d.category && d.category.toLowerCase().includes(q))
      );
    }
    if (args.where?.category) {
      result = result.filter((d) => d.category === args.where.category);
    }
    if (args.where?.available !== undefined) {
      result = result.filter((d) => d.available === args.where.available);
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
  count: async ({ where }) => {
    if (where?.chefId) {
      return dishes.filter((d) => d.chefId === where.chefId).length;
    }
    return dishes.length;
  }
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
  count: async ({ where }) => {
    if (where?.id) return chefs.filter((c) => c.id === where.id).length;
    return chefs.length;
  }
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
  count: async ({ where }) => {
    if (where?.id?.in) {
      return ingredients.filter((i) => where.id.in.includes(i.id)).length;
    }
    return ingredients.length;
  }
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
  // Start temporary test server
  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`\n==================================================`);
  console.log(`  BỘ KIỂM THỬ TỰ ĐỘNG BLOCK #6 (ACCEPTANCE SUITE)`);
  console.log(`  Target: ${baseUrl}`);
  console.log(`==================================================\n`);

  try {
  // Test 1: CORS & Preflight OPTIONS 204 (CORS-01, CORS-02)
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
    assert(
      preflight.headers.get('access-control-allow-origin') === 'http://localhost:5173',
      'CORS Allow-Origin must match exact origin'
    );
    assert(
      preflight.headers.get('access-control-allow-methods')?.includes('POST'),
      'CORS Allow-Methods must include POST'
    );
    assert(
      preflight.headers.get('access-control-allow-headers')?.toLowerCase().includes('content-type'),
      'CORS Allow-Headers must include Content-Type'
    );

    const normal = await fetch(`${baseUrl}/api/dishes`, {
      headers: { Origin: 'http://localhost:5173' }
    });
    assert(
      normal.headers.get('access-control-allow-origin') === 'http://localhost:5173',
      'GET Allow-Origin must match origin'
    );
  });

  // Test 2: Lỗi kỹ thuật 404 & 400 (API-13, API-14)
  await runTest('Test 02: Lỗi kỹ thuật 404 (sai URL) & 400 (bad JSON) không có trường "ok"', async () => {
    const res404 = await fetch(`${baseUrl}/api/bok`);
    assert(res404.status === 404, `Expected status 404, got ${res404.status}`);
    const json404 = await res404.json();
    assert(json404.error === 'API endpoint not found', `Expected error message 'API endpoint not found', got '${json404.error}'`);
    assert(json404.ok === undefined, '404 response must NOT contain "ok" property');

    const res400 = await fetch(`${baseUrl}/api/dishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad_json'
    });
    assert(res400.status === 400, `Expected status 400, got ${res400.status}`);
    const json400 = await res400.json();
    assert(json400.error === 'Malformed JSON payload', `Expected error message 'Malformed JSON payload', got '${json400.error}'`);
    assert(json400.ok === undefined, '400 response must NOT contain "ok" property');
  });

  // Test 3: GET /api/dishes & Search ?q= (API-01, API-02)
  await runTest('Test 03: GET /api/dishes & tìm kiếm ?q= (trả kèm chef & ingredients)', async () => {
    const listRes = await fetch(`${baseUrl}/api/dishes`);
    assert(listRes.status === 200, `Expected 200, got ${listRes.status}`);
    const listJson = await listRes.json();
    assert(listJson.ok === true, 'Expected ok: true');
    assert(Array.isArray(listJson.data), 'Expected data to be an array');
    assert(listJson.data.length > 0, 'Expected at least 1 dish');
    assert(listJson.data[0].chef !== undefined, 'Expected chef to be included');
    assert(Array.isArray(listJson.data[0].ingredients), 'Expected ingredients array');

    const searchRes = await fetch(`${baseUrl}/api/dishes?q=Bún`);
    assert(searchRes.status === 200, `Expected 200, got ${searchRes.status}`);
    const searchJson = await searchRes.json();
    assert(searchJson.ok === true, 'Expected ok: true');
    assert(Array.isArray(searchJson.data), 'Expected array data');

    const searchResPho = await fetch(`${baseUrl}/api/dishes?q=Phở`);
    const searchPhoJson = await searchResPho.json();
    assert(searchPhoJson.data.length >= 1, 'Expected search "Phở" to match at least 1 dish');
  });

  // Test 4: GET /api/dishes/:id & NOT_FOUND (API-03, API-04, API-05)
  await runTest('Test 04: GET /api/dishes/:id chi tiết & NOT_FOUND (ID 99999 hoặc "abc")', async () => {
    const detailRes = await fetch(`${baseUrl}/api/dishes/1`);
    assert(detailRes.status === 200, `Expected 200, got ${detailRes.status}`);
    const detailJson = await detailRes.json();
    assert(detailJson.ok === true, 'Expected ok: true');
    assert(detailJson.data.id === 1, 'Expected dish id 1');

    const notFoundRes = await fetch(`${baseUrl}/api/dishes/99999`);
    assert(notFoundRes.status === 200, `Expected 200, got ${notFoundRes.status}`);
    const notFoundJson = await notFoundRes.json();
    assert(notFoundJson.ok === false, 'Expected ok: false');
    assert(notFoundJson.error?.code === 'NOT_FOUND', `Expected code NOT_FOUND, got ${notFoundJson.error?.code}`);
    assert(notFoundJson.error?.fields === undefined, 'NOT_FOUND should not contain fields');

    const invalidIdRes = await fetch(`${baseUrl}/api/dishes/abc`);
    assert(invalidIdRes.status === 200, `Expected 200, got ${invalidIdRes.status}`);
    const invalidIdJson = await invalidIdRes.json();
    assert(invalidIdJson.ok === false, 'Expected ok: false');
    assert(invalidIdJson.error?.code === 'NOT_FOUND', `Expected code NOT_FOUND for "abc", got ${invalidIdJson.error?.code}`);
  });

  // Test 5: POST /api/dishes & VALIDATION_FAILED (API-06, API-07, API-08)
  let createdDishId = null;
  await runTest('Test 05: POST /api/dishes tạo mới & VALIDATION_FAILED (price chuỗi, giá âm)', async () => {
    // Valid creation
    const postRes = await fetch(`${baseUrl}/api/dishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bún Chả Hà Nội',
        price: 55000,
        category: 'Món nước',
        chefId: 1,
        ingredientIds: [1, 2]
      })
    });
    assert(postRes.status === 200, `Expected 200, got ${postRes.status}`);
    const postJson = await postRes.json();
    assert(postJson.ok === true, 'Expected ok: true');
    assert(postJson.data?.id > 0, 'Expected positive new id');
    assert(postJson.data?.chef?.id === 1, 'Expected chef to be attached');
    assert(postJson.data?.ingredients?.length === 2, 'Expected 2 ingredients');
    createdDishId = postJson.data.id;

    // Invalid negative price / empty name
    const invalidRes1 = await fetch(`${baseUrl}/api/dishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        price: -100,
        category: 'Món nước',
        chefId: 1
      })
    });
    assert(invalidRes1.status === 200, `Expected 200, got ${invalidRes1.status}`);
    const invalidJson1 = await invalidRes1.json();
    assert(invalidJson1.ok === false, 'Expected ok: false');
    assert(invalidJson1.error?.code === 'VALIDATION_FAILED', 'Expected VALIDATION_FAILED');
    assert(invalidJson1.error?.fields?.name, 'Expected field error for name');
    assert(invalidJson1.error?.fields?.price, 'Expected field error for price');

    // Number passed as string: { "name": "Phở", "price": "50000" } (API-08)
    const invalidRes2 = await fetch(`${baseUrl}/api/dishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phở',
        price: '50000',
        category: 'Món nước',
        chefId: 1
      })
    });
    assert(invalidRes2.status === 200, `Expected 200, got ${invalidRes2.status}`);
    const invalidJson2 = await invalidRes2.json();
    assert(invalidJson2.ok === false, 'Expected ok: false');
    assert(invalidJson2.error?.code === 'VALIDATION_FAILED', 'Expected VALIDATION_FAILED');
    assert(invalidJson2.error?.fields?.price, 'Expected error.fields.price rejecting string coercion');
  });

  // Test 6: PATCH /api/dishes/:id cập nhật & NOT_FOUND (API-09, API-10)
  await runTest('Test 06: PATCH /api/dishes/:id cập nhật & NOT_FOUND khi ID không tồn tại', async () => {
    const patchRes = await fetch(`${baseUrl}/api/dishes/${createdDishId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bún Chả Đặc Biệt',
        price: 65000
      })
    });
    assert(patchRes.status === 200, `Expected 200, got ${patchRes.status}`);
    const patchJson = await patchRes.json();
    assert(patchJson.ok === true, 'Expected ok: true');
    assert(patchJson.data.name === 'Bún Chả Đặc Biệt', 'Expected name updated');
    assert(patchJson.data.price === 65000, 'Expected price updated');

    const notFoundPatch = await fetch(`${baseUrl}/api/dishes/99999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Không tồn tại' })
    });
    assert(notFoundPatch.status === 200, `Expected 200, got ${notFoundPatch.status}`);
    const notFoundJson = await notFoundPatch.json();
    assert(notFoundJson.ok === false, 'Expected ok: false');
    assert(notFoundJson.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND');
  });

  // Test 7: DELETE /api/dishes/:id & NOT_FOUND (API-11, API-12)
  await runTest('Test 07: DELETE /api/dishes/:id xóa món & NOT_FOUND khi xóa lại', async () => {
    const delRes = await fetch(`${baseUrl}/api/dishes/${createdDishId}`, {
      method: 'DELETE'
    });
    assert(delRes.status === 200, `Expected 200, got ${delRes.status}`);
    const delJson = await delRes.json();
    assert(delJson.ok === true, 'Expected ok: true');
    assert(delJson.data === null, 'Expected data: null');

    const reGetRes = await fetch(`${baseUrl}/api/dishes/${createdDishId}`);
    const reGetJson = await reGetRes.json();
    assert(reGetJson.ok === false, 'Expected ok: false after deletion');
    assert(reGetJson.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND after deletion');

    const notFoundDel = await fetch(`${baseUrl}/api/dishes/99999`, {
      method: 'DELETE'
    });
    assert(notFoundDel.status === 200, `Expected 200, got ${notFoundDel.status}`);
    const notFoundDelJson = await notFoundDel.json();
    assert(notFoundDelJson.ok === false, 'Expected ok: false');
    assert(notFoundDelJson.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND');
  });

  // Test 8: CRUD /api/chefs (API-15)
  await runTest('Test 08: CRUD /api/chefs (GET, POST 200 OK, PATCH, DELETE, NOT_FOUND)', async () => {
    const listRes = await fetch(`${baseUrl}/api/chefs`);
    assert(listRes.status === 200, 'Expected 200');
    const listJson = await listRes.json();
    assert(listJson.ok === true && Array.isArray(listJson.data), 'Expected chefs list');

    const detailRes = await fetch(`${baseUrl}/api/chefs/1`);
    const detailJson = await detailRes.json();
    assert(detailJson.ok === true, 'Expected ok: true');
    assert(Array.isArray(detailJson.data.dishes), 'Expected chef dishes list');

    const postRes = await fetch(`${baseUrl}/api/chefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gordon Ramsay', specialty: 'Món Âu' })
    });
    assert(postRes.status === 200, `Expected 200, got ${postRes.status}`);
    const postJson = await postRes.json();
    assert(postJson.ok === true, 'Expected ok: true');
    const newChefId = postJson.data.id;

    const patchRes = await fetch(`${baseUrl}/api/chefs/${newChefId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specialty: 'Michelin 3 Stars' })
    });
    const patchJson = await patchRes.json();
    assert(patchJson.ok === true && patchJson.data.specialty === 'Michelin 3 Stars', 'Expected chef updated');

    const delRes = await fetch(`${baseUrl}/api/chefs/${newChefId}`, { method: 'DELETE' });
    const delJson = await delRes.json();
    assert(delJson.ok === true, 'Expected delete chef ok: true');

    const notFoundRes = await fetch(`${baseUrl}/api/chefs/abc`);
    const notFoundJson = await notFoundRes.json();
    assert(notFoundJson.ok === false && notFoundJson.error.code === 'NOT_FOUND', 'Expected NOT_FOUND for chef id "abc"');
  });

  // Test 9: CRUD /api/ingredients (API-15)
  await runTest('Test 09: CRUD /api/ingredients (GET, POST 200 OK, PATCH, DELETE, NOT_FOUND)', async () => {
    const listRes = await fetch(`${baseUrl}/api/ingredients`);
    assert(listRes.status === 200, 'Expected 200');
    const listJson = await listRes.json();
    assert(listJson.ok === true && Array.isArray(listJson.data), 'Expected ingredients list');

    const postRes = await fetch(`${baseUrl}/api/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hạt tiêu Phú Quốc', unit: 'gam' })
    });
    assert(postRes.status === 200, `Expected 200, got ${postRes.status}`);
    const postJson = await postRes.json();
    assert(postJson.ok === true, 'Expected ok: true');
    const newIngId = postJson.data.id;

    const patchRes = await fetch(`${baseUrl}/api/ingredients/${newIngId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit: 'kg' })
    });
    const patchJson = await patchRes.json();
    assert(patchJson.ok === true && patchJson.data.unit === 'kg', 'Expected unit updated');

    const delRes = await fetch(`${baseUrl}/api/ingredients/${newIngId}`, { method: 'DELETE' });
    const delJson = await delRes.json();
    assert(delJson.ok === true, 'Expected delete ingredient ok: true');

    const notFoundRes = await fetch(`${baseUrl}/api/ingredients/abc`);
    const notFoundJson = await notFoundRes.json();
    assert(notFoundJson.ok === false && notFoundJson.error.code === 'NOT_FOUND', 'Expected NOT_FOUND for ingredient id "abc"');
  });

  // Test 10: SPA Deep Link Fallback (SPA-03)
  await runTest('Test 10: SPA Deep Link Fallback & Security Checks (index.html structure, no DB leaks)', async () => {
    const indexPath = path.resolve('frontend/index.html');
    assert(fs.existsSync(indexPath), 'frontend/index.html must exist');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');
    assert(indexHtml.includes('id="root"'), 'index.html must contain root mount element');
    assert(indexHtml.includes('src="/src/main.tsx"'), 'index.html must load main entry point');
    assert(!indexHtml.includes('DATABASE_URL'), 'index.html must not contain DATABASE_URL');
    assert(!indexHtml.includes('postgres'), 'index.html must not contain postgres credentials');

    const feEnvExample = fs.readFileSync(path.resolve('frontend/.env.example'), 'utf-8');
    assert(!feEnvExample.includes('DATABASE_URL'), 'frontend/.env.example must not contain DATABASE_URL');
  });
  } finally {
    server.close();
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`  KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
  console.log(`--------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
